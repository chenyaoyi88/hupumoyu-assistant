import * as request from 'request';
import { _context } from '../extension';

export default function req(url: string, options?: { resJson?: Boolean, tipsName?: string }) {
    return new Promise((resolve, reject) => {
        if (options?.tipsName) {
            if (_context?.extensionMode === 2) {
                console.log(options.tipsName, '开始请求', url);
            }
        }
        request(url, {
            // 10 秒超时
            timeout: 10000,
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                let resData = {};
                if (options?.resJson === undefined || options?.resJson) {
                    resData = JSON.parse(body);
                    if (_context?.extensionMode === 2) {
                        console.log(options?.tipsName, '接口响应1', resData);
                    }
                } else {
                    resData = body;
                    if (_context?.extensionMode === 2) {
                        console.log(options?.tipsName, '接口响应2');
                    }
                }
                resolve(resData);
            } else {
                if (_context?.extensionMode === 2) {
                    console.log(options?.tipsName, '请求错误', err);
                }
                reject(err);
            }
        });
    });
};