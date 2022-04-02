function showLoading() {
    hideLoading();
    document.body.insertAdjacentHTML('beforeend', `
    <div id="hupumoyu-loading" class="hupumoyu-loading">加载中...</div>`);
}

function hideLoading() {
    const aLoading = document.querySelectorAll('.hupumoyu-loading');
    if (aLoading.length) {
        for (let item of aLoading) {
            document.body.removeChild(item);
        }
    }
}

// 节流
function throttle(fn, delay) {
    let valid = true;
    return function () {
        if (!valid) {
            return false;
        }
        valid = false;
        setTimeout(() => {
            fn();
            valid = true;
        }, delay);
    };
}

// 防抖
function debounce(fn, delay) {
    let timer = null;;
    return function () {
        if (timer) {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        } else {
            timer = setTimeout(fn, delay);
        }
    };
}