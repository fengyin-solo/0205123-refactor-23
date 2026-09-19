/* ========== List View（列表页共用：加载态 / 失败重试 / 空态 / 翻页） ==========
 *
 * 用户端所有列表页共用同一份状态处理逻辑，各页面只提供：
 *   - fetch(page)   数据来源（返回分页对象或数组）
 *   - renderItem    单条数据的渲染
 *   - 自己的空态文案/图标
 *
 * 后端分页接口统一返回 { records, total }（MyBatis-Plus IPage），
 * 非分页接口返回数组；解析逻辑只此一处。
 */

/** 统一解析列表返回结构：{records}/{list}/裸数组 */
function extractListData(res) {
    const list = res && (res.records || res.list) ? (res.records || res.list)
        : (Array.isArray(res) ? res : []);
    const total = res && !Array.isArray(res) && res.total != null
        ? res.total
        : list.length;
    return { list: list || [], total: total };
}

function listLoadingHtml() {
    return '<div class="loading"><div class="spinner"></div><p>' + t('loading') + '</p></div>';
}

/**
 * 创建一个列表视图。
 * @param {Object} opt
 * @param {string|HTMLElement} opt.container   列表容器（选择器或元素）
 * @param {(page:number)=>Promise<any>} opt.fetch  数据来源；null/失败表示加载失败
 * @param {(item:any,index:number)=>string} opt.renderItem  单条 HTML
 * @param {string|HTMLElement} [opt.pagination] 分页容器，不传则不渲染分页
 * @param {number} [opt.pageSize=9]
 * @param {string} [opt.emptyIcon]   空态图标 fontawesome 类，默认 fa-inbox
 * @param {string} [opt.emptyText]   空态文案，默认 t('noData')
 * @param {string|function} [opt.emptyHtml] 自定义空态（如插画），提供后覆盖图标+文案
 * @param {string} [opt.errorText]   加载失败文案，默认“加载失败，请重试”
 * @param {string} [opt.wrapTag]     用 renderItem 渲染时，外层包裹标签（默认直接拼接）
 * @param {string} [opt.wrapClass]   外层包裹标签的 class
 */
function createListView(opt) {
    const container = typeof opt.container === 'string' ? document.querySelector(opt.container) : opt.container;
    const pageEl = opt.pagination
        ? (typeof opt.pagination === 'string' ? document.querySelector(opt.pagination) : opt.pagination)
        : null;
    const pageSize = opt.pageSize || 9;

    const view = {
        currentPage: 1,
        totalRecords: 0,
        loading: false
    };

    function emptyContent() {
        if (opt.emptyHtml) return typeof opt.emptyHtml === 'function' ? opt.emptyHtml() : opt.emptyHtml;
        const icon = opt.emptyIcon || 'fa-inbox';
        const text = opt.emptyText || t('noData');
        return '<div class="empty"><i class="fas ' + icon + '"></i><p>' + text + '</p></div>';
    }

    function errorContent() {
        const text = opt.errorText || '加载失败，请重试';
        return '<div class="empty list-error">' +
            '<i class="fas fa-exclamation-triangle"></i>' +
            '<p>' + text + '</p>' +
            '<a class="list-retry-btn" onclick="this.closest(\'.list-error\').__retry()"><i class="fas fa-rotate-right"></i> 点击重试</a>' +
        '</div>';
    }

    function showLoading() {
        container.innerHTML = listLoadingHtml();
        if (pageEl) pageEl.innerHTML = '';
    }

    async function load(page) {
        if (view.loading) return;
        view.loading = true;
        view.currentPage = page || 1;
        showLoading();
        let res;
        try {
            res = await opt.fetch(view.currentPage);
        } catch (e) {
            res = null;
        }

        if (res === null || res === undefined || res === false) {
            container.innerHTML = errorContent();
            container.querySelector('.list-error').__retry = () => load(view.currentPage);
            if (pageEl) pageEl.innerHTML = '';
            view.loading = false;
            return;
        }

        const { list, total } = extractListData(res);
        view.totalRecords = total;

        if (!list.length) {
            container.innerHTML = emptyContent();
            if (pageEl) pageEl.innerHTML = '';
            view.loading = false;
            document.dispatchEvent(new CustomEvent('listRefresh', { detail: view }));
            return;
        }

        let html = list.map((item, i) => opt.renderItem(item, i)).join('');
        if (opt.wrapTag) {
            html = '<' + opt.wrapTag + (opt.wrapClass ? ' class="' + opt.wrapClass + '"' : '') + '>' +
                html + '</' + opt.wrapTag + '>';
        }
        container.innerHTML = html;

        if (pageEl) {
            renderPagination(pageEl, view.currentPage, view.totalRecords, pageSize, (p) => load(p));
        }
        view.loading = false;
        document.dispatchEvent(new CustomEvent('listRefresh', { detail: view }));
    }

    view.load = load;
    view.reload = () => load(view.currentPage);
    return view;
}
