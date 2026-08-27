import XLSX from 'xlsx';

const mvPoints = Array.from({ length: 28 }, (_, i) => ({
  Route: "MV",
  Sequence: i + 1,
  Point: `MV${i + 1}`,
  Latitude: -2.58975 + i * 0.00045,
  Longitude: 31.31061 + i * 0.00010,
  Description: i === 0 ? "MV Start" : i === 27 ? "MV End" : `MV Pole ${i + 1}`
}));

const lvPoints = Array.from({ length: 28 }, (_, i) => ({
  Route: "LV",
  Sequence: i + 1,
  Point: `LV${i + 1}`,
  Latitude: -2.57850 + i * 0.00030,
  Longitude: 31.31311 + i * 0.00040,
  Description: i === 0 ? "LV Start" : i === 27 ? "LV End" : `LV Pole ${i + 1}`
}));

const allData = [...mvPoints, ...lvPoints];
const ws = XLSX.utils.json_to_sheet(allData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "public/test_mv_lv.xlsx");
console.log("Created public/test_mv_lv.xlsx with MV (28) and LV (28) points");
