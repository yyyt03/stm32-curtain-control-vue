<template>
  <view class="wrap">
    <!-- 添加下拉刷新指示器 -->
    <view class="refresh-tip" v-if="isRefreshing">
      <text>正在刷新数据...</text>
    </view>
    
    <view class="dev-area">
      <!-- 模式切换卡片 -->
      <view class="dev-card">
        <view class="">
          <view class="dev-name">控制模式</view>
          <image class="dev-log" src="../../static/curtain.png"></image>
        </view>
        <view class="curtain-control">
          <view class="mode-switch">
            <text>{{ mode === 1 ? '手动' : '自动' }}</text>
            <switch :checked="mode === 1" @change="onCurtainModeSwitch" color="#1afa29" :disabled="isRequesting"/>
          </view>
        </view>
      </view>
      
      <!-- 手动控制卡片（仅手动模式显示） -->
      <view class="dev-card" v-if="mode === 1">
        <view class="">
          <view class="dev-name">手动控制</view>
          <image class="dev-log" src="../../static/curtain.png"></image>
        </view>
        <view class="manual-control">
          <button class="control-btn" @click="onCurtainReverse" :disabled="isRequesting">-30°</button>
          <button class="control-btn" @click="onCurtainForward" :disabled="isRequesting">+30°</button>
        </view>
      </view>
      
      <!-- 数据展示卡片 -->
      <view class="dev-card">
        <view class="">
          <view class="dev-name">光照强度</view>
          <image class="dev-log" src="../../static/curtain.png"></image>
        </view>
        <view class="dev-data" :class="{'data-updated': dataUpdated}">{{ light }}lux</view>
      </view>
      <view class="dev-card">
        <view class="">
          <view class="dev-name">当前角度</view>
          <image class="dev-log" src="../../static/curtain.png"></image>
        </view>
        <view class="dev-data">{{ angle }}°</view>
      </view>
    </view>
    
    <!-- 添加错误提示 -->
    <view class="error-message" v-if="errorMsg">
      <text>{{ errorMsg }}</text>
      <button class="retry-btn" @click="retryConnection">重试</button>
    </view>
  </view>
</template>

<script>
	const {
		createCommonToken
	} = require('@/key.js')
	
	// 抽离API配置
	const API_CONFIG = {
	  BASE_URL: 'https://iot-api.heclouds.com/thingmodel',
	  PRODUCT_ID: 'iMin8bQ9c6',
	  DEVICE_NAME: 'd1'
	};
	
	export default {
		data() {
			return {
			    light: 0,       // 光照强度
			    angle: 90,      // 当前角度
			    mode: 0,        // 0-自动模式 1-手动模式
			    isRequesting: false, // 请求状态标记
			    dataUpdated: false,  // 数据更新标记，用于动画
			    timer: null,         // 定时器引用
			    errorMsg: '',        // 错误信息
			    isRefreshing: false  // 刷新状态
			}
		},
		onLoad() {
			const params = {
				author_key: 'NJxjxGSvmbNL+VjP0D8wD1nYphRxKHOeOdzY8ZqIQ43rKFw2mY9BMFKCKtZ4PvOJ',
				version: '2022-05-01',
				user_id: '417772',
			}
			this.token = createCommonToken(params);
			// 初始加载数据
			this.getDataFromOnenet();
		},
		onShow() {
			// 清除旧的定时器
			if (this.timer) clearInterval(this.timer);
			// 设置新的定时器
			this.timer = setInterval(() => { 
				this.getDataFromOnenet();
			}, 3000);
		},
		onHide() {
		    // 页面隐藏时清除定时器
		    if (this.timer) {
		        clearInterval(this.timer);
		        this.timer = null;
		    }
		},
		onUnload() {
		    // 页面卸载时清除定时器
		    if (this.timer) {
		        clearInterval(this.timer);
		        this.timer = null;
		    }
		},
		// 添加下拉刷新
		onPullDownRefresh() {
		    this.isRefreshing = true;
		    this.getDataFromOnenet(true).finally(() => {
		        setTimeout(() => {
		            uni.stopPullDownRefresh();
		            this.isRefreshing = false;
		        }, 800);
		    });
		},
		methods: {
			/**
			 * 从OneNET平台获取设备数据
			 * 通过物联网平台API获取设备属性，并更新本地数据
			 * @param {Boolean} isManualRefresh 是否手动刷新
			 * @returns {Promise} 请求Promise
			 */
			getDataFromOnenet(isManualRefresh = false) {
			    // 避免重复请求
			    if (this.isRequesting && !isManualRefresh) return Promise.resolve();
			    this.isRequesting = true;
			    this.errorMsg = ''; // 清除错误信息
			    
				return new Promise((resolve, reject) => {
				    uni.request({
					    // OneNET物模型-查询设备属性接口
					    url: `${API_CONFIG.BASE_URL}/query-device-property`,
					    method: 'GET',
					    // 设备标识参数
					    data: {
						    product_id: API_CONFIG.PRODUCT_ID,
						    device_name: API_CONFIG.DEVICE_NAME,
					    },
					    header: {
						    'authorization': this.token // 认证token
					    },
					    success: (res) => {
						    if (res.data && res.data.code === 0) {
						        // 存储旧数据用于比较
						        const oldData = {
						            light: this.light,
						            angle: this.angle,
						            mode: this.mode
						        };
						    
						        // 将设备数据转换为键值对映射
						        const dataMap = res.data.data.reduce((map, item) => {
							        map[item.identifier] = item.value;
							        return map;
						        }, {});

						        // 根据标识符更新本地数据
						        this.light = dataMap.light; // 光照强度
						        this.angle = dataMap.angle; // 当前角度
						        this.mode = parseInt(dataMap.mode); // 工作模式
						        
						        // 检查数据是否有更新，显示更新动画
						        if (oldData.light !== this.light || 
						            oldData.angle !== this.angle || 
						            oldData.mode !== this.mode) {
						            this.triggerUpdateAnimation();
						        }
						        
						        resolve(res.data);
						    } else {
						        this.errorMsg = '获取数据失败：' + (res.data?.msg || '未知错误');
						        reject(new Error(this.errorMsg));
						    }
					    },
					    fail: (err) => {
					        this.errorMsg = '网络请求失败，请检查网络连接';
					        console.error('网络请求失败：', err);
					        reject(err);
					    },
					    complete: () => {
					        this.isRequesting = false;
					    }
				    });
				});
			},
			
			/**
			 * 触发数据更新动画
			 */
			triggerUpdateAnimation() {
			    this.dataUpdated = true;
			    setTimeout(() => {
			        this.dataUpdated = false;
			    }, 1000);
			},
			
			/**
			 * 重试连接
			 */
			retryConnection() {
			    this.errorMsg = '';
			    this.getDataFromOnenet();
			},
			
			/**
			 * 发送设备属性更新请求
			 * @param {Object} params 要更新的属性
			 * @returns {Promise} 请求Promise
			 */
			sendPropertyUpdate(params) {
			    if (this.isRequesting) {
			        uni.showToast({
			            title: '请等待上一个操作完成',
			            icon: 'none'
			        });
			        return Promise.reject('操作过于频繁');
			    }
			    
			    this.isRequesting = true;
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
				            if (res.data.code === 0) {
				                resolve(res.data);
				            } else {
				                const errMsg = '操作失败：' + (res.data?.msg || '未知错误');
				                uni.showToast({
				                    title: errMsg,
				                    icon: 'none'
				                });
				                reject(new Error(errMsg));
				            }
				        },
				        fail: (err) => {
				            uni.showToast({
				                title: '网络请求失败',
				                icon: 'none'
				            });
				            reject(err);
				        },
				        complete: () => {
				            this.isRequesting = false;
				        }
			        });
			    });
			},
			
			// 切换窗帘模式
			onCurtainModeSwitch(event) {
			  const newMode = event.detail.value ? 1 : 0;
			  uni.showLoading({ title: '正在切换模式...' });
			  
			  this.sendPropertyUpdate({ "mode": newMode })
			    .then(() => {
			        // 成功操作反馈
			        uni.showToast({
			            title: `已切换到${newMode === 1 ? '手动' : '自动'}模式`,
			            icon: 'success'
			        });
			        this.mode = newMode;
			    })
			    .finally(() => {
			        uni.hideLoading();
			    });
			},
			
			// 修改正转/反转逻辑（角度步进）
			onCurtainForward() {
			  const newAngle = Math.min(this.angle + 30, 180);
			  this.updateCurtainAngle(newAngle);
			},
			
			onCurtainReverse() {
			  const newAngle = Math.max(this.angle - 30, 0);
			  this.updateCurtainAngle(newAngle);
			},
			
			// 统一角度更新方法
			updateCurtainAngle(angle) {
			  if (this.angle === angle) return; // 避免重复设置相同角度
			  
			  uni.showLoading({ title: '正在调整...' });
			  this.sendPropertyUpdate({ "angle": angle })
			    .then(() => {
			        // 即时更新本地显示，不等待下次轮询
			        this.angle = angle;
			    })
			    .finally(() => {
			        uni.hideLoading();
			    });
			}
		}
	}
</script>

<style>
	.wrap {
		padding: 30rpx;
		position: relative;
	}
	.dev-area {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.dev-card {
		height: 200rpx;
		width: 320rpx;
		border-radius: 30rpx;
		margin-top: 30rpx;
		display: flex;
		justify-content:space-around;
		align-items: center;
		box-shadow: 0 0 15rpx #ccc;
	}
	.dev-name {
		font-size: 20rpx;
		text-align: center;
		color: #6d6d6d;
	}
	.dev-log {
		height: 70rpx;
		width: 70rpx;
		margin-top: 10rpx;
	}
	.dev-data {
		font-size: 50rpx;
		color: #6d6d6d;
	}
	.curtain-control {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.mode-switch {
		display: flex;
		align-items: center;
		font-size: 24rpx;
		color: #6d6d6d;
	}
	.manual-control {
		display: flex;
		gap: 10rpx;
	}
	.control-btn {
		font-size: 24rpx;
		padding: 10rpx 20rpx;
		background-color: #2484f1;
		color: white;
		border: none;
		border-radius: 10rpx;
		min-width: 80rpx;
		transition: all 0.3s;
	}
	
	.control-btn:active {
	    transform: scale(0.95);
	    opacity: 0.8;
	}
	
	.control-btn[disabled] {
	    background-color: #cccccc;
	    opacity: 0.6;
	}
	
	/* 添加数据更新动画 */
	.data-updated {
	    animation: highlight 1s ease;
	}
	
	@keyframes highlight {
	    0% { color: #6d6d6d; }
	    30% { color: #2484f1; }
	    100% { color: #6d6d6d; }
	}
	
	/* 错误提示样式 */
	.error-message {
	    position: fixed;
	    bottom: 30rpx;
	    left: 0;
	    right: 0;
	    background-color: rgba(255, 0, 0, 0.1);
	    padding: 20rpx;
	    display: flex;
	    justify-content: center;
	    align-items: center;
	    flex-direction: column;
	}
	
	.retry-btn {
	    margin-top: 10rpx;
	    font-size: 24rpx;
	    padding: 10rpx 30rpx;
	    background-color: #f15a24;
	    color: white;
	    border-radius: 10rpx;
	}
	
	/* 刷新提示 */
	.refresh-tip {
	    text-align: center;
	    padding: 10rpx 0;
	    font-size: 24rpx;
	    color: #2484f1;
	}
</style>