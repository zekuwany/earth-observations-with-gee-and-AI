var roiPolygon =
    /* color: #d63000 */
    /* shown: false */
    ee.FeatureCollection([
      ee.Feature(
        ee.Geometry.Polygon([
          [
            [-118.6459, 35.2727],
            [-119.4809, 34.2801],
            [-119.1952, 34.062],
            [-118.6459, 33.9436],
            [-118.525, 33.7428],
            [-118.3273, 33.6057],
            [-118.0636, 33.5782],
            [-117.4374, 33.0825],
            [-117.2616, 32.5563],
            [-116.8385, 31.6034],
            [-115.7069, 31.809],
            [-115.9376, 33.1988],
            [-116.2343, 34.2132],
            [-117.8479, 34.9426],
            [-118.4961, 35.2303],
          ],
        ]),
        {
          "system:index": "0",
        }
      ),
    ]),
  rgbVis = {
    opacity: 1,
    bands: ["SR_B4", "SR_B3", "SR_B2"],
    min: 7442.32,
    max: 20897.68,
    gamma: 1,
  },
  nbrChangeVis = {
    opacity: 1,
    bands: ["NBR"],
    min: -0.20572173446416855,
    max: 0.3000249400734901,
    palette: [
      "ff1b02",
      "fff90e",
      "19ff0c",
      "0b7514",
      "19ff0c",
      "fff90e",
      "ff1b02",
    ],
  },
  ndviChangeVis = {
    opacity: 1,
    bands: ["NDVI"],
    min: -0.14491868317127227,
    max: 0.19916710555553435,
    palette: ["17a623", "67ff0a", "eeff0a", "ff7008", "ff0200"],
  };

// 1. Load Landsat-9 Dataset and mask Cloud
// Define the Region of Interest (ROI)
Map.centerObject(roiPolygon, 7);

// Load Landsat 9 imagery and apply cloud mask
function loadLandsatData(start, end) {
  return ee
    .ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate(start, end)
    .filterBounds(roiPolygon)
    .map(cloudMaskL8to9)
    .map(function (img) {
      return img.clip(roiPolygon);
    })
    .select(["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"]);
}

// Cloud mask function
function cloudMaskL8to9(image) {
  var qa = image.select("QA_PIXEL");
  var mask = qa
    .bitwiseAnd(1 << 1)
    .eq(0)
    .and(qa.bitwiseAnd(1 << 2).eq(0))
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0));
  return image.updateMask(mask);
}

// 2. Load pre- and post wildfire imagery
var preFireImagery = loadLandsatData("2024-11-01", "2024-12-31").median();
var postFireImagery = loadLandsatData("2025-01-07", "2025-02-19").median();

Map.addLayer(preFireImagery, rgbVis, "Pre-Imagery", false);
Map.addLayer(postFireImagery, rgbVis, "Post-Fire", false);

// 3. Compute NDVI and NBR before and after
function computeIndex(image, b1, b2, name) {
  return image.normalizedDifference([b1, b2]).rename(name);
}

var ndviBefore = computeIndex(preFireImagery, "SR_B5", "SR_B4", "NDVI");
var ndviAfter = computeIndex(postFireImagery, "SR_B5", "SR_B4", "NDVI");
var nbrBefore = computeIndex(preFireImagery, "SR_B5", "SR_B7", "NBR");
var nbrAfter = computeIndex(postFireImagery, "SR_B5", "SR_B7", "NBR");

Map.addLayer(ndviBefore, {}, "NDVI Before", false);
Map.addLayer(ndviAfter, {}, "NDVI After", false);

// 4. Compute change in NDVI and NBR
var ndviChange = ndviBefore.subtract(ndviAfter);
var nbrChange = nbrBefore.subtract(nbrAfter);

// 5. Mask out water bodies
var waterMask = ee
  .ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .select("label")
  .mode()
  .neq(0)
  .clip(roiPolygon);
Map.addLayer(waterMask, {}, "water mask", false);

var ndviChangeMasked = ndviChange.updateMask(waterMask);
var nbrChangeMasked = nbrChange.updateMask(waterMask);

Map.addLayer(ndviChange, {}, "NDVI Change", false);
Map.addLayer(nbrChange, {}, "NBR Change", false);
Map.addLayer(nbrChangeMasked, nbrChangeVis, "NBR Change (masked)", false);
Map.addLayer(ndviChangeMasked, ndviChangeVis, "NDVI Change (Masked)", false);

// 6. Calculate area of change in NDVI and NBR
var ndviAffected = ndviChangeMasked.gt(0.1);
var ndviArea = ndviAffected
  .multiply(ee.Image.pixelArea().divide(1e6))
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    maxPixels: 1e13,
    bestEffort: true,
    geometry: roiPolygon,
    scale: 1000,
  })
  .values()
  .get(0);

print("NDVI Change Extent (sq.km):", ee.Number(ndviArea));

// Calculate burned area extent based on NBR
var burnedThreshold = nbrChange.lt(-0.1).or(nbrChange.gt(0.27));
var burnedArea = burnedThreshold
  .multiply(ee.Image.pixelArea().divide(1e6))
  .reduceRegion({ reducer: ee.Reducer.sum(), geometry: roiPolygon, scale: 500 })
  .values()
  .get(0);

print("Total Burned Area (sq.km):", ee.Number(burnedArea));

// 7. Plot legend
// Define the legend panel
var legend = ui.Panel({
  style: {
    position: "bottom-right",
    padding: "8px 15px",
  },
});

// Title for the legend
var legendTitle = ui.Label({
  value: "Burn Area Index (NBR Change)",
  style: { fontWeight: "bold", fontSize: "14px", margin: "0 0 4px 0" },
});

legend.add(legendTitle);

// Define the color palette
var palette = [
  "#ff0404",
  "#f0ff0c",
  "#46ff0a",
  "#0d6a07",
  "#46ff0a",
  "#f0ff0c",
  "#ff0404",
];

// Define the legend labels (you can adjust based on actual data range)
var labels = ["<-0.03", "-0.02", "-0.01", "0", "0.01", "0.02", ">0.09"];

// Create legend items
for (var i = 0; i < palette.length; i++) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: palette[i],
      padding: "8px",
      margin: "0 4px 4px 0",
    },
  });

  var label = ui.Label({
    value: labels[i],
    style: { margin: "0 0 4px 4px", fontSize: "12px" },
  });

  var legendItem = ui.Panel({
    widgets: [colorBox, label],
    layout: ui.Panel.Layout.Flow("horizontal"),
  });

  legend.add(legendItem);
}

// Add the legend to the map
Map.add(legend);

// Export your map to google drive
// Define export parameters
var exportRegion = roiPolygon.geometry(); // Use your ROI
var exportScale = 30; // Landsat resolution (adjust if needed)

// Export NDVI Change Map
Export.image.toDrive({
  image: ndviChangeMasked, // NDVI change image
  description: "NDVI_Change_Map", // File name in Drive
  folder: "GEE_Exports", // Google Drive folder (optional)
  fileNamePrefix: "NDVI_Change",
  scale: exportScale,
  region: exportRegion,
  crs: "EPSG:4326", // Coordinate Reference System (WGS84)
  maxPixels: 1e13, // Prevents size limit issues
});

// Export NBR Change Map
Export.image.toDrive({
  image: nbrChangeMasked, // NBR change image
  description: "NBR_Change_Map", // File name in Drive
  folder: "GEE_Exports", // Google Drive folder (optional)
  fileNamePrefix: "NBR_Change",
  scale: exportScale,
  region: exportRegion,
  crs: "EPSG:4326",
  maxPixels: 1e13,
});
