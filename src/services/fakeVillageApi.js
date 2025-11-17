// src/fakeVillageApi.js

// ================== FAKE DATA THEO VILLAGE ==================
// Toạ độ mình đặt demo ở khu vực miền Bắc Thái Lan.
// Sau này bạn thay bằng dữ liệu thật của bạn.

export const fakeVillageStatsByName = {
  ก้องนา: {
    village_id: "6308040201",
    village_name: "ก้องนา",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 16.033657649202745,
    longitude: 98.65914030352496,
    years: [
      { year: 2023, case_sum: 100 },
      { year: 2024, case_sum: 79 },
      { year: 2025, case_sum: 67 },
    ],
  },
  ป่าโหล: {
    village_id: "6308040202",
    village_name: "ป่าโหล",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 17.9,
    longitude: 98.45,
    years: [
      { year: 2023, case_sum: 2 },
      { year: 2024, case_sum: 3 },
      { year: 2025, case_sum: 10 },
    ],
  },
  ห้วยฟูแกง: {
    village_id: "6308040203",
    village_name: "ห้วยฟูแกง",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 18.05,
    longitude: 98.55,
    years: [
      { year: 2023, case_sum: 1 },
      { year: 2024, case_sum: 4 },
      { year: 2025, case_sum: 20 },
    ],
  },
  หนองหลวง: {
    village_id: "6308040204",
    village_name: "หนองหลวง",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 17.3,
    longitude: 98.8,
    years: [
      { year: 2023, case_sum: 3 },
      { year: 2024, case_sum: 8 },
      { year: 2025, case_sum: 30 },
    ],
  },
  บ้านหัวดอย: {
    village_id: "6308040205",
    village_name: "บ้านหัวดอย",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 17.1,
    longitude: 98.65,
    years: [
      { year: 2023, case_sum: 1 },
      { year: 2024, case_sum: 2 },
      { year: 2025, case_sum: 10 },
    ],
  },
  ผาลัด: {
    village_id: "6308040206",
    village_name: "ผาลัด",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 16.75,
    longitude: 98.75,
    years: [
      { year: 2023, case_sum: 5 },
      { year: 2024, case_sum: 7 },
      { year: 2025, case_sum: 40 },
    ],
  },
  เวียงต้า: {
    village_id: "6308040207",
    village_name: "เวียงต้า",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 16.4,
    longitude: 98.9,
    years: [
      { year: 2023, case_sum: 1 },
      { year: 2024, case_sum: 1 },
      { year: 2025, case_sum: 2 },
    ],
  },
  เสาหิน: {
    village_id: "6308040208",
    village_name: "เสาหิน",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 16.05,
    longitude: 99.0,
    years: [
      { year: 2023, case_sum: 4 },
      { year: 2024, case_sum: 6 },
      { year: 2025, case_sum: 30 },
    ],
  },
  ห้วยขาแข้ง: {
    village_id: "6308040209",
    village_name: "ห้วยขาแข้ง",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 15.8,
    longitude: 99.1,
    years: [
      { year: 2023, case_sum: 2 },
      { year: 2024, case_sum: 2 },
      { year: 2025, case_sum: 10 },
    ],
  },
  เขาน้อย: {
    village_id: "6308040210",
    village_name: "เขาน้อย",
    from_date: "01-Jan",
    to_date: "31-Dec",
    latitude: 15.6,
    longitude: 99.0,
    years: [
      { year: 2023, case_sum: 3 },
      { year: 2024, case_sum: 4 },
      { year: 2025, case_sum: 30 },
    ],
  },
};

// ============= TẠO GEOJSON POINTS ĐỂ VẼ LÊN MAP =============
export const villagesGeoJson = {
  type: "FeatureCollection",
  features: Object.values(fakeVillageStatsByName).map((v) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [v.longitude, v.latitude], // [lng, lat]
    },
    properties: {
      id: v.village_id,
      name: v.village_name,
      // số hiển thị trong vòng tròn (demo: dùng case năm 2025)
      count: v.years[v.years.length - 1].case_sum,
    },
  })),
};

// ============= FAKE API – CHỈ GỌI KHI CLICK ==================
export async function fakeFetchVillageStatsByName(name) {
  // Giả lập network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const data = fakeVillageStatsByName[name];
  if (!data) return null;

  const latestYear = data.years[data.years.length - 1];

  return {
    summary: [
      {
        village_id: data.village_id,
        village_name: data.village_name,
        case_sum: String(latestYear.case_sum),
        Latitude: String(data.latitude),
        Longitude: String(data.longitude),
      },
    ],
    detail: data,
  };
}

/*
// Khi có API thật, bạn đổi hàm trên thành:

export async function fakeFetchVillageStatsByName(name) {
  const res = await fetch(`/api/villages?name=${encodeURIComponent(name)}`);
  const json = await res.json();
  return json;
}
*/
