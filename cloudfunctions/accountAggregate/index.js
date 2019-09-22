// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {

  const wxContext = cloud.getWXContext();
  cloud.updateConfig({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV
  })
  // 初始化数据库
  const db = cloud.database({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV
  });

  const $ = db.command.aggregate;
  const { mode, startDate, endDate, flow, categoryId, OPENID } = event;

  const basicProject = {
    _id: 0,
    money: 1,
    isDel: 1,
    openId: 1,
    flow: 1,
    categoryId: 1,
    isTarget: $.and([
      $.gte([$.dateToString({
        date: '$noteDate',
        format: '%Y-%m-%d',
        timezone: 'Asia/Shanghai'
      }), startDate]),
      $.lte([$.dateToString({
        date: '$noteDate',
        format: '%Y-%m-%d',
        timezone: 'Asia/Shanghai'
      }), endDate])
    ])
  };

  // 按时间聚合, 聚合出支出和收入(即两个flow)的数据
  // 判断时间思路: 筛选出时间范围合适的记录置为"isTarget", 最后统计isTarget的数目和金钱
  if (mode === 'aggregateAccountByDateRange') {

    const basicMatch = {
      isDel: false,
      openId: $.eq(OPENID ? OPENID : wxContext.OPENID),
      isTarget: true,
    };

    const sumResult = await db.collection("DANDAN_NOTE")
      .aggregate()
      .project(basicProject)
      .match(basicMatch)
      .group({
        _id: "$flow",
        allSum: $.sum("$money"),
        count: $.sum(1)
      })
      .end();
    return {
      sumResult: sumResult.list
    }
  }
 
  // 根据FLOW和时间流向详细聚合数据
  if (mode === 'aggregateAccountInDetail') {

    const basicMatch = {
      isDel: false,
      openId: $.eq(OPENID ? OPENID : wxContext.OPENID),
      flow: Number(flow),
      isTarget: true,
    };

    // 求详细的结果, 只涉及到二级目录
    const detailResult = await db.collection("DANDAN_NOTE")
      .aggregate()
      .project(basicProject)
      .match(basicMatch)
      .group({
        _id: '$categoryId',
        allSum: $.sum("$money"),
        count: $.sum(1),
      })
      .end();
    console.log(detailResult)
    
    // 总体结果
    // TODO: 假如数据库是瓶颈, 这里可以改为直接遍历detailResult来获取这个sumResult
    const sumResult = await db.collection("DANDAN_NOTE")
      .aggregate()
      .project(basicProject)
      .match(basicMatch)
      .group({
        _id: null,
        allSum: $.sum("$money"),
        count: $.sum(1),
        allCategoryId: $.addToSet("$categoryId")
      })
      .end();

    // TODO: 等官方出了连接查询这里可以直接使用聚合和连接的方法处理好数据

    return {
      sumResult: sumResult.list.length > 0 ? sumResult.list[0] : {},
      detailResult: detailResult.list,
    }
  }

  
}


function keepTwoDecimal(num) {
  var result = parseFloat(num);
  if (isNaN(result)) {
    alert('传递参数错误，请检查！');
    return false;
  }
  result = Math.round(num * 100) / 100;
  return result;
};
