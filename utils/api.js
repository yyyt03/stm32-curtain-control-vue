const { createCommonToken } = require('@/key.js');

// OneNET API配置
export const API_CONFIG = {
  BASE_URL: 'https://iot-api.heclouds.com/thingmodel',
  PRODUCT_ID: 'iMin8bQ9c6',
  DEVICE_NAME: 'd1'
};

// 创建API服务类
export class OneNetService {
  constructor() {
    // 初始化token
    const params = {
      author_key: 'NJxjxGSvmbNL+VjP0D8wD1nYphRxKHOeOdzY8ZqIQ43rKFw2mY9BMFKCKtZ4PvOJ',
      version: '2022-05-01',
      user_id: '417772',
    };
    this.token = createCommonToken(params);
  }

  /**
   * 获取设备属性
   * @returns {Promise} 包含设备属性的Promise
   */
  getDeviceProperties() {
    return new Promise((resolve, reject) => {
      uni.request({
        url: `${API_CONFIG.BASE_URL}/query-device-property`,
        method: 'GET',
        data: {
          product_id: API_CONFIG.PRODUCT_ID,
          device_name: API_CONFIG.DEVICE_NAME,
        },
        header: {
          'authorization': this.token
        },
        success: (res) => {
          if (res.data && res.data.code === 0) {
            // 将设备数据转换为键值对映射
            const dataMap = res.data.data.reduce((map, item) => {
              map[item.identifier] = item.value;
              return map;
            }, {});
            
            resolve(dataMap);
          } else {
            reject(new Error(res.data?.msg || '获取设备属性失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }

  /**
   * 设置设备属性
   * @param {Object} params 要设置的属性
   * @returns {Promise} 操作结果Promise
   */
  setDeviceProperties(params) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: `${API_CONFIG.BASE_URL}/set-device-property`,
        method: 'POST',
        data: {
          product_id: API_CONFIG.PRODUCT_ID,
          device_name: API_CONFIG.DEVICE_NAME,
          params: params
        },
        header: {
          'authorization': this.token
        },
        success: (res) => {
          if (res.data && res.data.code === 0) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || '设置设备属性失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
}

// 导出单例实例
export const oneNetService = new OneNetService();
