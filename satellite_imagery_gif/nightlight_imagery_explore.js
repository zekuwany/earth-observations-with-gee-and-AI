var nepal = ee.FeatureCollection("projects/ee-teksondada/assets/nepal"),
  aoi =
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
      [
        [
          [85.05146642264782, 27.909335600985003],
          [85.05146642264782, 27.489848913616324],
          [85.6818069988197, 27.489848913616324],
          [85.6818069988197, 27.909335600985003],
        ],
      ],
      null,
      false
    ),
  visParams = { min: 0, max: 60, palette: ["black", "red", "yellow", "white"] };

// Function to get the night lights image for a given year
function getNightLights(year) {
  year = ee.Number(year); // Convert to ee.Number explicitly
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year.add(1), 1, 1);

  var collection = ee
    .ImageCollection("NOAA/DMSP-OLS/NIGHTTIME_LIGHTS")
    .filterDate(startDate, endDate);

  // Check if collection contains any images
  var count = collection.size(); // Get the number of images in the collection

  var img = ee.Algorithms.If(
    count.gt(0), // If there is data, process it
    collection.median().select("avg_vis").clip(nepal).set("year", year),
    null // If no data, return null (will be filtered out later)
  );

  return img;
}

// Generate images for each year from 1992 to 2014
var years = ee.List.sequence(1992, 2014);
var images = years.map(getNightLights);

// Remove null values (years with missing data)
var validImages = images.removeAll([null]);

// Define bbox to visualize image
var bbox = nepal.geometry().simplify(1000).buffer(30000);
print(bbox);

// Create an ImageCollection from the list
var imageCollection = ee.ImageCollection(validImages);
print(imageCollection);
print(imageCollection.first().get("year"));

var gifImgCollection = imageCollection.map(function (img) {
  return img.visualize(visParams).clip(nepal);
});

// Add the first available year's image to the map (optional)
Map.centerObject(nepal, 6);
Map.addLayer(imageCollection.first(), visParams, "Night Lights");

// Create an animated GIF
var gifParams = {
  dimensions: 500,
  region: bbox,
  framesPerSecond: 1,
  crs: "EPSG:4326",
  format: "gif",
};

//==============================================
//Add annotation on gif
//==============================================

var text = require("users/gena/packages:text"); // Import gena's package which allows text overlay on image
var annotations = [
  {
    position: "right",
    offset: "1%",
    margin: "1%",
    property: "label",
    scale: Map.getScale() * 2,
  },
];

// add text as a string
var position = ee.Geometry.Point([80.0, 26.8]);
function addText(image) {
  var timeStamp = image.get("year"); // get the time stamp of each frame. This can be any string. Date, Years, Hours, etc.
  var img = image
    .visualize({
      //convert each frame to RGB image explicitly since it is a 1 band image
      forceRgbOutput: true,
      min: 0.0,
      max: 60.0,
      palette: ["black", "red", "orange", "yellow", "white"],
    })
    .set({ label: ee.String(timeStamp).slice(0, 4) }); // set a property called label for each image

  var annotated = text.annotateImage(img, {}, position, annotations); // create a new image with the label overlayed using gena's package

  return annotated;
}

// add annotation
var tempCol = imageCollection.map(addText);

// get the url to download video
print(tempCol.getVideoThumbURL(gifParams));

// Generate the GIF URL
print(ui.Thumbnail(tempCol, gifParams));

//=================================================
//overlay vector
//=================================================
// Define an empty image to paint features to.
var empty = ee.Image().byte();

// Paint country feature edges to the empty image.
var nepalOutline = empty
  .paint({ featureCollection: nepal, color: 1, width: 1 })
  // Convert to an RGB visualization image; set line color to black.
  .visualize({ palette: "white" });

// border outline image on all collection images.
var tempColOutline = tempCol.map(function (img) {
  return img.blend(nepalOutline);
});

// Display the animation.
print(ui.Thumbnail(tempColOutline, gifParams));

//=====================================================
// Overlay hillshade
//=====================================================
// Define a hillshade layer from SRTM digital elevation model.
var hillshade = ee.Terrain.hillshade(
  ee
    .Image("USGS/SRTMGL1_003")
    // Exaggerate the elevation to increase contrast in hillshade.
    .multiply(100)
)
  // Clip the DEM by Nepal boundary to clean boundary between
  // land and ocean.
  .clipToCollection(nepal);

// Map a blend operation over the temperature collection to overlay a partially
// opaque temperature layer on the hillshade layer.
var finalVisCol = tempColOutline.map(function (img) {
  return hillshade.blend(img.visualize({ opacity: 0.6 }));
});

// get the url to download video
print(finalVisCol.getVideoThumbURL(gifParams));

// Display the animation.
print(ui.Thumbnail(finalVisCol, gifParams));

// Reference
//1. https://developers.google.com/earth-engine/guides/ic_visualization
