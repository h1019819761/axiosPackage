import axios from 'axios';

const { RSA, DES3 } = window;

/* eslint-disable */
const randomString = function (t) { t = t || 32; for (var e = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678", r = e.length, n = "", i = 0; i < t; i++)n += e.charAt(Math.floor(Math.random() * r)); return n }
/* eslint-enable */

const IS_DEBUG = process.env.NODE_ENV === 'development';

/**
 * 生产环境下，对请求参数进行加密
 * @param {Object} options 请求参数
 */
function dealRequest(options) {
  return new Promise((resolve, reject) => {
    try {
      const body = options.data;
      if (!window.random) {
        window.random = randomString(24);
      }
      const clientRandom = window.random;

      const desKey = RSA.encrypt(clientRandom);
      const requestParaString = JSON.stringify(body);
      // eslint-disable-next-line camelcase
      const DES3_requestParaString = DES3.encrypt(clientRandom, requestParaString);
      const reqestJson = {
        desKey,
        data: DES3_requestParaString,
      };
      // eslint-disable-next-line no-param-reassign
      options.data = JSON.stringify(reqestJson);
      resolve(options);
    } catch (error) {
      reject(error);
    }
  });
}
/**
 * 生产环境下对接口返回的参数进行解密
 * @param {Object} response 响应体
 */
function dealResponse(response) {
  return new Promise((resolve, reject) => {
    if (response.code === '0') {
      const resultData = response.data;
      const jsonstrText = DES3.decrypt(window.random, resultData);
      const decryptResponse = JSON.parse(jsonstrText);
      if (decryptResponse.responseCode === 'XAT000001') {
        return reject(new Error('请重新登录'));
      }
      if (decryptResponse.responseCode === '00000' || decryptResponse.responseCode === 'XAT000006' || decryptResponse.responseCode === 'XAT000003') {
        return resolve(decryptResponse);
      }
      const responseDesc = decryptResponse.responseDesc ? decryptResponse.responseDesc : '请检查网络连接';
      const error = new Error(responseDesc);
      error.response = decryptResponse;
      return reject(error);
    }
    const error = new Error('请检查网络连接');
    error.response = response;
    return reject(error);
  });
}

/**
 * 开发环境下，对返回体的处理
 * @param {Object} response 响应体
 */
function dealDebugResponse(response) {
  if (Object.prototype.toString.call(response) === '[object Blob]') {
    return Promise.resolve(response);
  }
  return new Promise((resolve, reject) => {
    if (response.responseCode === 'XAT000001') {
      return reject(new Error('请重新登录'));
    }
    if (response.responseCode === '00000' || response.responseCode === 'XAT000006' || response.responseCode === 'XAT000003') {
      return resolve(response);
    }
    const responseDesc = response.responseDesc ? response.responseDesc : '请检查网络连接';
    const error = new Error(responseDesc);
    error.response = response;
    return reject(error);
  });
}
/**
 * 对请求的返回状态进行处理
 * @param {Object} response 相应体
 */
function checkStatus(response) {
  return new Promise((resolve, reject) => {
    if (response.status >= 200 && response.status < 300) {
      resolve(response);
    }
    const error = new Error('请检查网络连接');
    error.response = response;
    reject(error);
  });
}

/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */

const defaultOptions = {
  method: 'POST',
  headers: {},
};

async function request(url, options) {
  let currentOptions = {
    ...defaultOptions,
    ...options,
  };
  const requestBody = currentOptions.data ? currentOptions.data : {};

  if (requestBody instanceof FormData) {
    // 文件上传
    currentOptions.headers['Content-Type'] = 'multipart/form-data';
    currentOptions.data = requestBody;
  } else {
    currentOptions.headers['Content-Type'] = 'application/json;charset=UTF-8';
    currentOptions.data = requestBody;
  }
  // 一、生产环境下，加密请求参数
  if (!IS_DEBUG) {
    currentOptions = await dealRequest(currentOptions);
  }
  // 二、获取到返回体
  let response = null;
  try {
    response = await axios(url, currentOptions);
  } catch (error) {
    return Promise.reject(new Error('网络错误'));
  }

  // 四、处理返回码
  await checkStatus(response);

  // 五、返回 JSON 数据
  const requestJson = response.data;

  // 六、处理返回值
  let responseData;
  if (!IS_DEBUG) {
    responseData = await dealResponse(requestJson);
  } else {
    responseData = await dealDebugResponse(requestJson);
  }

  return responseData;
}

export default request;
