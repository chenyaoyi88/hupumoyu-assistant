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

    const renderReplyDetail = (data, list) => {
        let ret = '';
        for (let item of list) {
            ret += `
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
                ${item.quote_info ? `
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
                        <span style="cursor: pointer;" data-comment data-tid="${data.tid}" data-pid="${item.pid}">查看回复(${item.replies})</span>
                    </div>
                </div>
        </div>`;
        }
        return ret;
    };

    // 点击查看回复
    function setReplyClick() {
        const aReplayList = document.querySelectorAll('[data-comment]');
        // console.log('回复列表', aReplayList);
        // @ts-ignore
        for (let i = 0; i < aReplayList.length; i++) {
            aReplayList[i].addEventListener('click', (event) => {
                const target = event.target || event.srcElement;
                if (target.dataset.tid && target.dataset.pid) {
                    vscode.postMessage({
                        command: 'getPostReply',
                        content: {
                            tid: target.dataset.tid,
                            pid: target.dataset.pid,
                        },
                    });
                }
            }, false);
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

    function renderImage() {
        const aImages = document.querySelectorAll('[data_url]');
        if (aImages.length) {
            for (let i = 0; i < aImages.length; i++) {
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
            oContentLight.querySelector('#lightReplyContent').innerHTML = renderReplyDetail(data, data.postLightReplyContent);
            oContentLight.style.display = 'block';
        } else {
            oContentLight.style.display = 'none';
        }

        if (data.postGrayReplyContent) {
            oContentGray.querySelector('#grayReplyContent').innerHTML = renderReplyDetail(data, data.postGrayReplyContent);;
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
    }
}());