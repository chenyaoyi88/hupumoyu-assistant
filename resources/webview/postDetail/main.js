// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    const oldState = (vscode.getState());

    let selectedReplyElement = null;

    // 如果之前有值，则回填
    if (oldState && oldState.data) {
        hideLoading();
        setContent(oldState.data);
    }

    // 接收信息
    window.addEventListener('message', event => {
        const message = event.data;
        const data = message.data;
        switch (message.command) {
            case 'showLoading':
                showLoading();
                break;
            case 'hideLoading':
                hideLoading();
                break;
            case 'switchMode':
                const aContent = document.querySelectorAll('[data-target="content"]');
                if (data.mode === 'bossComing') {
                    for (let i = 0; i < aContent.length; i++) {
                        aContent[i].classList.add('hide-content');
                    }
                    const fakeContent = document.querySelector('#fakeContent');
                    fakeContent.style.display = 'block';
                    if (!fakeContent.innerHTML) {
                        fakeContent.innerHTML = 'Hello world!';
                    }
                } else {
                    for (let i = 0; i < aContent.length; i++) {
                        aContent[i].classList.remove('hide-content');
                    }
                    document.querySelector('#fakeContent').style.display = 'none';
                }
                break;
            case 'updatePostDetail':
                hideLoading();
                setContent(data);
                break;
            case 'postReply':
                if (selectedReplyElement) {
                    let str = '';
                    for (let item of data) {
                        str += `
                    <div class="reply-list-item">
                      <p class="reply-list-item-title">
                        <a href="javascript;">${item.author.puname} </a>
                        <span> ${item.createdAtFormat}</span>
                      </p>
                      <div class="reply-list-item-content">
                        ${item.content}
                      </div>
                      <div class="reply-list-item-light">
                        亮了(${item.count})
                      </div>
                    </div>
                    `;
                    }
                    const oReplyItemBox = selectedReplyElement.querySelector('.reply-list-item-box');
                    if (oReplyItemBox) {
                        oReplyItemBox.innerHTML = str;
                    } else {
                        str = `
                    <div class="reply-list-item-box">
                        ${str}
                    </div>`;
                        selectedReplyElement.insertAdjacentHTML('beforeend', str);
                    }

                    const newReplyList = selectedReplyElement.querySelectorAll('.reply-list-item-box img,video');

                    addImgHideCoverClass(newReplyList);
                    showPostImgAndVideo(newReplyList);
                }
                break;
            default:
                hideLoading();
        }
    });

    function setReplyClick() {

        const aReplayList = document.querySelectorAll('.todo-list.todo-list-replay');

        // @ts-ignore
        for (let i = 0; i < aReplayList.length; i++) {
            aReplayList[i].addEventListener('click', (event) => {
                const sMsg = event.target.parentElement.parentElement.parentElement.previousElementSibling.firstElementChild.children[2].getAttribute('data-admininfo');

                selectedReplyElement = event.target.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;

                if (selectedReplyElement.getAttribute('data-reply') === '1') {
                    selectedReplyElement.setAttribute('data-reply', '0');
                    const oReplyItemBox = selectedReplyElement.querySelector('.reply-list-item-box');
                    if (oReplyItemBox) {
                        oReplyItemBox.outerHTML = '';
                    }
                } else {
                    selectedReplyElement.setAttribute('data-reply', '1');
                    if (sMsg) {
                        const oMsg = JSON.parse(sMsg);
                        const oState = vscode.getState();
                        if (oState && oState.data) {
                            oMsg.tid = oState.data.tid;
                        }
                        vscode.postMessage({
                            command: 'getPostReply',
                            content: oMsg,
                        });
                    }
                }
            }, false);
        }
    }

    function rerenderPagination(data = {}) {
        const aPageEle = document.querySelectorAll('.hupumoyu-pagination-hide .hupu-rc-pagination-item');
        const oContent = /** @type {HTMLElement} */ document.getElementById('hupumoyu-content-box');
        const oPagination = /** @type {HTMLElement} */ document.querySelector('#hupumoyu-pagination');
        if (aPageEle && aPageEle.length) {
            const oLastPage = aPageEle[aPageEle.length - 1];
            if (oLastPage) {
                const value = oLastPage.querySelector('.block-c').getAttribute('href');
                const lastPageNo = Number(value.split('.')[0].split('-')[1]);

                const currentState = (vscode.getState());
                let currentPageNo = data.pageNo || Number(currentState.data.pageNo);

                oPagination.innerHTML = `
                <a href="javascript;" class="hupumoyu-pagination-item" data-id="first" data-page="first">首页</a>
                <a href="javascript;" class="hupumoyu-pagination-item" data-id="prev" data-page="prev">上一页</a>
                <a href="javascript;" class="hupumoyu-pagination-item" data-id="next" data-page="next">下一页</a>
                <a href="javascript;" class="hupumoyu-pagination-item" data-id="last" data-page="last">尾页</a>
                <span href="javascript;" class="hupumoyu-pagination-item">${currentPageNo}/${lastPageNo}</span>
                `;

                oContent.style.height = window.innerHeight - oPagination.offsetHeight - 15 + 'px';
                oContent.scrollTo(0, 0);

                const aPageItem = /** @type {HTMLElement} */ oPagination.querySelectorAll('.hupumoyu-pagination-item');

                const pagechange = (pageNo) => {
                    showLoading();
                    vscode.postMessage({
                        command: 'pagechange',
                        content: {
                            pageNo,
                            tid: currentState.data.tid,
                        },
                    });
                };

                for (let i = 0; i < aPageItem.length; i++) {
                    aPageItem[i].addEventListener('click', function (e) {
                        const page = e.target.dataset.page;
                        switch (page) {
                            case 'first':
                                pagechange(1);
                                break;
                            case 'prev':
                                currentPageNo--;
                                if (currentPageNo < 1) {
                                    currentPageNo = 1;
                                }
                                pagechange(currentPageNo);
                                break;
                            case 'next':
                                currentPageNo++;
                                if (currentPageNo > lastPageNo) {
                                    currentPageNo = lastPageNo;
                                }
                                pagechange(currentPageNo);
                                break;
                            case 'last':
                                pagechange(lastPageNo);
                                break;
                        }
                    }, false);
                }
            }
        } else {
            oPagination.innerHTML = '';

            oContent.style.height = 'auto';
            oContent.scrollTo(0, 0);
        }
    }

    function showPostImgAndVideo(list) {
        const oldState = (vscode.getState());
        for (let i = 0; i < list.length; i++) {
            if (oldState.data.showPostImgs) {
                list[i].parentElement.classList.remove('hupumoyu-img-conver');
            } else {
                list[i].classList.add('hide');
            }
            list[i].addEventListener('click', function (e) {
                this.classList.toggle('hide');
                this.parentElement.classList.toggle('hupumoyu-img-conver');
            }, false);
        }
    }

    // 添加隐藏图片覆盖样式
    function addImgHideCoverClass(selectorList) {
        let aImg = [];
        if (selectorList) {
            aImg = selectorList;
        } else {
            aImg = document.querySelectorAll('#hupumoyu-postDetail img,video');
        }
        for (let item of aImg) {
            if (item.parentElement.nodeName === 'P' || item.parentElement.nodeName === 'DIV') {
                if (!item.parentElement.classList.contains('hupumoyu-img-conver')) {
                    item.parentElement.classList.add('hupumoyu-img-conver');
                }
            }
        }
    }

    function setContent(data) {
        console.log('帖子详情---main.js', data);
        document.querySelector('#fakeContent').style.display = 'none';
        vscode.setState({
            data,
        });
        const oTitle = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-title'));
        const oThreadContentDetail = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-content-main'));
        const oContentLight = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-content-light'));
        const oContentGray = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-content-gray'));
        const oPaginationHide = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-pagination-hide'));

        oTitle.innerHTML =
            `
            <p>${data.title || ''}<a style="margin: 0 5px;" href="javascript;" data-id="open">浏览器打开</a></p>
            <p>
                <a href="javascript;">${data.author || ''}</a>
                <span>${data.createTime || ''}</span>
            </p>
            `;
        oThreadContentDetail.innerHTML = data.postContent || '';

        const oOpen = document.querySelector('[data-id="open"]');
        oOpen.setAttribute('data-url', data.url);
        oOpen.onclick = function () {
            vscode.postMessage({
                command: 'openBrowser',
                content: this.getAttribute('data-url'),
            });
        };

        if (data.postLightReplyContent) {
            oContentLight.querySelector('#lightReplyContent').innerHTML = data.postLightReplyContent;
            oContentLight.style.display = 'block';
        } else {
            oContentLight.style.display = 'none';
        }

        if (data.postGrayReplyContent) {
            oContentGray.querySelector('#grayReplyContent').innerHTML = data.postGrayReplyContent;
            oContentGray.style.display = 'block';
        } else {
            oContentGray.style.display = 'none';
        }

        if (data.pagination) {
            oPaginationHide.innerHTML = data.pagination;
        } else {
            oPaginationHide.innerHTML = '';
        }

        // 没有内容
        if (data.noContent) {
            oThreadContentDetail.innerHTML = data.noContent || '';
        }

        const oContent = document.querySelector('#hupumoyu-content-box');
        // 用来隐藏页面未渲染完成时页面凌乱的状态
        oContent.classList.remove('hide');
        // 滚到最顶部
        oContent.scrollTo(0, 0);
        window.scrollTo(0, 0);

        setReplyClick();
        addImgHideCoverClass();
        showPostImgAndVideo(document.querySelectorAll('#hupumoyu-postDetail img,video'));
        rerenderPagination(data);
    }

    window.addEventListener('resize', () => {
        rerenderPagination();
    });
}());