var dataset = ls8
  .filterDate("2013-10-01", "2013-12-30")
  .filterBounds(aoi)
  .filter(ee.Filter.lt("CLOUD_COVER", 5))
  .map(function (image) {
    return image.clip(aoi);
  });

var median_image = dataset.median();

Map.addLayer(median_image, imageVisParam);
// Map.centerObject(aoi.geometry())

//plotting spectral response curve

var subset = median_image.select("B[2-7]");
var samples = ee.FeatureCollection([
  forest,
  builtup,
  agriculture,
  bareland,
  river,
  sand,
  cloud,
]);

//creating scatter chart
var plotOptions = {
  title: "Landsat 8 Surface Reflectance Spectral",
  hAxis: { title: "Wavelength (nanometers)" },
  vAxis: { title: "Reflectance" },
  lineWidth: 2,
  pointSize: 4,
  curveType: "function",
  series: {
    0: { color: "green" }, //forest
    1: { color: "red" }, //builtup
    2: { color: "lime" }, //agriculture
    3: { color: "#e08700" }, //barren
    4: { color: "blue" }, //river
    5: { color: "#CFB99F" }, //sand
    6: { color: "#c7c4bf" }, //cloud
  },
};

// mean wavelengths based on bands from 2 to 7
var wavelengths = [482, 562, 655, 865, 1609, 2201];

var chart1 = ui.Chart.image
  .regions(subset, samples, ee.Reducer.mean(), 10, "label", wavelengths)
  .setChartType("LineChart")
  .setOptions(plotOptions);

print(chart1);
