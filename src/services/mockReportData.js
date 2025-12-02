const mockData = {
  totalPlans: 9413,
  planStatuses: {
    Cancel: 920,
    Draft: 430,
    Processing: 850,
    Expire: 4880,
    Done: 1333,
  },
  focusClassification: {
    A1: 6500,
    A2: 450,
    B1: 900,
    B2: 300,
    "-": 1263,
  },

  monthlyCommodities: [
    { m: "Oct", llins: 120, repellent: 220, net: 60, total: 400 },
    { m: "Nov", llins: 200, repellent: 140, net: 80, total: 420 },
    { m: "Dec", llins: 70, repellent: 50, net: 20, total: 140 },
    { m: "Jan", llins: 140, repellent: 240, net: 90, total: 470 },
    { m: "Feb", llins: 20, repellent: 30, net: 10, total: 60 },
    { m: "Mar", llins: 310, repellent: 180, net: 120, total: 610 },
    { m: "Apr", llins: 1800, repellent: 400, net: 689, total: 2889 }, // big spike like image
    { m: "May", llins: 950, repellent: 420, net: 343, total: 1713 },
    { m: "Jun", llins: 108, repellent: 45, net: 250, total: 403 },
    { m: "Jul", llins: 120, repellent: 40, net: 9, total: 169 },
    { m: "Aug", llins: 165, repellent: 22, net: 8, total: 230 },
    { m: "Sep", llins: 210, repellent: 60, net: 0, total: 270 },
  ],

  familiesByMonth: [
    { m: "Oct", household: 4300, members: 9500 },
    { m: "Nov", household: 5200, members: 18700 },
    { m: "Dec", household: 2400, members: 7600 },
    { m: "Jan", household: 3200, members: 12300 },
    { m: "Feb", household: 1100, members: 4200 },
    { m: "Mar", household: 6200, members: 14200 },
    { m: "Apr", household: 4600, members: 18800 },
    { m: "May", household: 3900, members: 12200 },
    { m: "Jun", household: 2900, members: 6400 },
    { m: "Jul", household: 2100, members: 5200 },
    { m: "Aug", household: 1300, members: 3300 },
    { m: "Sep", household: 800, members: 2000 },
  ],
};

export default mockData;
