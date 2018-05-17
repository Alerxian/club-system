
const config = require('../config');

/**
 * 计算页码
 * @param {number} currentPage  当前页面
 * @param {number} allPage 总页数
 * @param {number} showPageSize 显示页码数
 */
var getPages = exports.get = function(currentPage, allPage,showPageSize) {
  let step = Math.floor(showPageSize / 2);
  let startPage = currentPage - step;
  if(startPage < step) {
    startPage = 1;
  }else if(startPage + showPageSize > allPage) {
    startPage = allPage - showPageSize + 1;
  }
  let endPage = startPage + showPageSize -1 > allPage
    ? allPage : startPage + showPageSize -1;
  
    return {
      current: currentPage,
      start: startPage,
      end: endPage
    }
}

exports.addFindPageForQuery = function(schema, method) {
  schema.static(method, findPageForQuery)
}

async function findPageForQuery (query, field, options, current_page, pageSize, showPageNum) {
  pageSize = pageSize || config.pageSize;
  showPageNum = showPageNum || config.showPageNum;

  //开始条数
  let start_item_num = (current_page -1) * pageSize;
  //查询总条数
  let count = await this.countQ(query); 
  //总页数
  let all_page_num = Math.ceil(count / pageSize);
  let pages = getPages(current_page, all_page_num, showPageNum);

  options = Object.assign(options, {
    skip: start_item_num,
    limit: pageSize
  });
  // page 大于start_item_num 限制数目为pageSize

  let data = await this.find(query, field, options);
  return {
    data: data,
    page: pages,
    count:count
  }
}