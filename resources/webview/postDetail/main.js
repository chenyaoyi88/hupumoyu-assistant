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

    function renderImage () {
        const aImages = document.querySelectorAll('[data_url]');
        if (aImages.length) {
            for (let i = 0; aImages.length; i++) {
                aImages[i].innerHTML = `<div class="bbs-img"><img src="${aImages[i].getAttribute('src')}" /></div>`;
            }
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
            <p>${data.title || ''}<a style="margin: 0 5px;" href="${data.url}" target="_blank">浏览器打开</a></p>
            <p>
                <a href="javascript;">${data.author || ''}</a>
                <span>${data.createTime || ''}</span>
            </p>
            `;
        oThreadContentDetail.innerHTML = data.postContent || '';

        if (data.postLightReplyContent) {
            let lightReplies = '';
            for (let item of data.postLightReplyContent) {
                lightReplies += `
            <div class="post-reply-list">
                <div class="discuss-card__header">
                        <div class="discuss-card__avatar" style="background-image:url(${item.user.header})"></div>
                        <div class="discuss-card__header-right">
                            <p class="discuss-card__user">
                                <span class="discuss-card__username">${item.user.username}</span>
                            </p>
                            <time class="discuss-card__time">${item.createDt}</time><span class="discuss-card__ip"> · ${item.location}</span>
                        </div>
                    </div>
                    ${
                        item.quote_info ? `
                        <div class="discuss-card__quote-container">
                            <div class="discuss-card__quote-container-quote">
                                <span class="discuss-card__quote-container-discusser">${item.quote_info.username}：</span>
                                <span class="discuss-card__quote-content">${item.quote_info.content}</span>
                            </div>
                        </div>` : ''
                    }
                    <div class="discuss-card__content-container">
                        ${item.content}
                    </div>
                    <div class="discuss-card__actions">
                        <div class="discuss-card__actions-item light">
                            <span>亮了(${item.light})</span>
                        </div>
                        <div class="discuss-card__actions-item comment">
                            <span style="cursor: pointer;">查看回复(${item.replies})</span>
                        </div>
                    </div>
            </div>`;
            }
            // <p class="discuss-card__content">宁王只能嘴别人，别人嘴他就不行了，会红温的</p>
            // <div class="discuss-card__images">
            //     <div class="fufu-info-flow-container " data-type="image" style="width: 78.828px; height: 78.828px;">
            //         <img alt="discuss-image" class="hupu-fufu-lazy-img fufu-info-flow__content" width="78.828" src="https://i1.hoopchina.com.cn/hupuapp/bbs/0/0/thread_0_20220705070937_s_922031_o_w_308_h_308_46617.jpg?x-oss-process=image/resize,w_225/qulity,Q_60" height="78.828">
            //     </div>
            // </div>
            oContentLight.querySelector('#lightReplyContent').innerHTML = lightReplies;
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

        renderImage();
        setReplyClick();
        addImgHideCoverClass();
        showPostImgAndVideo(document.querySelectorAll('#hupumoyu-postDetail img,video'));
        rerenderPagination(data);
    }

    window.addEventListener('resize', () => {
        rerenderPagination();
    });
}());