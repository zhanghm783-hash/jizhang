/** 支付方式（一期固定列表） */
export const PAYMENT_METHODS = ["微信", "支付宝", "现金", "银行卡", "信用卡", "其他"];

/** 内置两级分类（首次启动时写入数据库） */
export interface SeedCategory {
  name: string;
  icon: string;
  children: string[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: "餐饮食品", icon: "🍜", children: ["早餐", "午餐", "晚餐", "零食饮料", "水果", "外卖点餐", "请客聚餐", "食材采购"] },
  { name: "交通出行", icon: "🚗", children: ["公交地铁", "出租网约车", "高铁火车", "飞机", "加油充电", "停车费", "共享单车", "车辆保养"] },
  { name: "购物消费", icon: "🛒", children: ["服饰鞋包", "数码家电", "日用百货", "美妆护肤", "运动户外", "宠物用品"] },
  { name: "居住生活", icon: "🏠", children: ["房租房贷", "水电燃气", "物业费", "宽带话费", "家居用品", "家政维修"] },
  { name: "娱乐休闲", icon: "🎮", children: ["电影演出", "游戏充值", "旅游度假", "运动健身", "咖啡茶饮", "会员订阅"] },
  { name: "医疗健康", icon: "💊", children: ["门诊买药", "体检保健", "住院治疗", "牙科眼科"] },
  { name: "教育学习", icon: "📚", children: ["书籍文具", "课程培训", "考试报名", "学费"] },
  { name: "人情往来", icon: "🎁", children: ["红包礼金", "送礼", "孝敬父母", "公益捐款"] },
  { name: "金融支出", icon: "💰", children: ["手续费", "利息", "罚金"] },
  { name: "其他杂项", icon: "📦", children: ["其他"] },
];
