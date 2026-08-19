// Create RUBIZA LV test Excel file for workflow testing
const ExcelJS = require('exceljs');
const path = require('path');

async function createTestFiles() {
  // RUBIZA LV
  const lv = new ExcelJS.Workbook();
  const lvSheet = lv.addWorksheet('Pole Schedule');
  lvSheet.columns = [
    { header: 'Pole Description', key: 'desc', width: 25 },
    { header: 'Latitude', key: 'lat', width: 15 },
    { header: 'Longitude', key: 'lon', width: 15 },
  ];
  const lvData = [
    ['TRF RUBIZA-50kVA', -2.58975, 31.31061],
    ['LV1', -2.58930, 31.31071],
    ['LV2', -2.58885, 31.31081],
    ['LV3', -2.58841, 31.31091],
    ['LV4', -2.58797, 31.31101],
    ['LV5AP', -2.58752, 31.31111],
    ['LV6', -2.58710, 31.31132],
    ['LV7AP', -2.58669, 31.31152],
    ['LV8', -2.58625, 31.31165],
    ['LV9', -2.58582, 31.31178],
    ['LV10', -2.58538, 31.31191],
    ['LV11', -2.58495, 31.31204],
    ['LV12AP', -2.58450, 31.31218],
    ['LV13', -2.58409, 31.31240],
    ['LV14', -2.58369, 31.31263],
    ['LV15', -2.58329, 31.31284],
    ['LV16AP', -2.58290, 31.31307],
    ['LV17AP', -2.58302, 31.31345],
    ['LV18AP', -2.58329, 31.31382],
    ['LV19', -2.58339, 31.31426],
    ['LV20', -2.58349, 31.31470],
    ['LV21', -2.58358, 31.31514],
    ['LV22AP', -2.58368, 31.31559],
    ['LV23AP', -2.58384, 31.31603],
    ['LV24AP', -2.58416, 31.31635],
    ['LV25TM', -2.58433, 31.31678],
  ];
  lvData.forEach(([desc, lat, lon]) => lvSheet.addRow({ desc, lat, lon }));
  lvSheet.getRow(1).font = { bold: true };
  await lv.xlsx.writeFile(path.join(__dirname, 'test-data', 'RUBIZA_LV.xlsx'));

  // RUBIZA MV
  const mv = new ExcelJS.Workbook();
  const mvSheet = mv.addWorksheet('Pole Schedule');
  mvSheet.columns = [
    { header: 'Pole Description', key: 'desc', width: 25 },
    { header: 'Latitude', key: 'lat', width: 15 },
    { header: 'Longitude', key: 'lon', width: 15 },
  ];
  const mvData = [
    ['TP', -2.60907, 31.30390],
    ['PA', -2.60877, 31.30439],
    ['MA', -2.60824, 31.30503],
    ['INT', -2.60741, 31.30526],
    ['INT', -2.60661, 31.30547],
    ['INT', -2.60581, 31.30569],
    ['INT', -2.60501, 31.30590],
    ['PA', -2.60422, 31.30612],
    ['INT', -2.60345, 31.30652],
    ['INT', -2.60274, 31.30690],
    ['PA', -2.60201, 31.30729],
    ['MA', -2.60130, 31.30767],
    ['INT', -2.60066, 31.30817],
    ['INT', -2.59983, 31.30815],
    ['PA', -2.59901, 31.30812],
    ['INT', -2.59825, 31.30846],
    ['INT', -2.59750, 31.30880],
    ['INT', -2.59675, 31.30914],
    ['PA', -2.59600, 31.30948],
    ['INT', -2.59519, 31.30958],
    ['INT', -2.59438, 31.30969],
    ['INT', -2.59357, 31.30980],
    ['INT', -2.59276, 31.30990],
    ['PA', -2.59193, 31.31001],
    ['PA', -2.59118, 31.31031],
    ['INT', -2.59035, 31.31049],
    ['TRF RUBIZA-50kVA', -2.58975, 31.31061],
    ['TERMINAL', -2.58946, 31.31069],
  ];
  mvData.forEach(([desc, lat, lon]) => mvSheet.addRow({ desc, lat, lon }));
  mvSheet.getRow(1).font = { bold: true };
  await mv.xlsx.writeFile(path.join(__dirname, 'test-data', 'RUBIZA_MV.xlsx'));

  // Minimal test (lat/lon only)
  const min = new ExcelJS.Workbook();
  const minSheet = min.addWorksheet('Sheet1');
  minSheet.columns = [
    { header: 'Latitude', key: 'lat', width: 15 },
    { header: 'Longitude', key: 'lon', width: 15 },
  ];
  [
    [-2.58975, 31.31061],
    [-2.58930, 31.31071],
    [-2.58885, 31.31081],
    [-2.58841, 31.31091],
  ].forEach(([lat, lon]) => minSheet.addRow({ lat, lon }));
  await min.xlsx.writeFile(path.join(__dirname, 'test-data', 'Minimal_LatLon.xlsx'));

  console.log('Test files created in test-data/');
}

createTestFiles().catch(console.error);
