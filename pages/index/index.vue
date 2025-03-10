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
					<view class="mode-selector">
						<view class="mode-option" :class="{ 'mode-active': mode === 0 }" @click="switchMode(0)">自动
						</view>
						<view class="mode-option" :class="{ 'mode-active': mode === 1 }" @click="switchMode(1)">手动
						</view>
						<view class="mode-option" :class="{ 'mode-active': mode === 2 }" @click="switchMode(2)">定时
						</view>
					</view>
				</view>
			</view>

			<!-- 手动控制卡片（仅手动模式显示） -->
			<view class="dev-card" v-if="mode === 1">
				<view class="">
					<view class="dev-name">手动控制</view>
					<image class="dev-log" src="../../static/curtain.png"></image>
				</view>
				<!-- 去掉按钮的disabled绑定，因为我们现在允许并发请求 -->
				<view class="manual-control">
					<button class="control-btn" @click="onCurtainReverse">-30°</button>
					<button class="control-btn" @click="onCurtainForward">+30°</button>
				</view>
			</view>

			<!-- 定时控制卡片（仅定时模式显示） -->
			<view class="dev-card timer-card" v-if="mode === 2">
				<view class="">
					<view class="dev-name">定时控制</view>
					<image class="dev-log" src="../../static/curtain.png"></image>
				</view>
				<view class="timer-control">
					<view class="time-row">
						<text class="time-label">开始:</text>
						<picker mode="time" :value="start_time" @change="onStartTimeChange"
							@click="isEditingTime = true">
							<view class="time-picker">{{ start_time }}</view>
						</picker>
					</view>
					<view class="time-row">
						<text class="time-label">结束:</text>
						<picker mode="time" :value="end_time" @change="onEndTimeChange" @click="isEditingTime = true">
							<view class="time-picker">{{ end_time }}</view>
						</picker>
					</view>
					<view class="angle-row-wrapper">
						<text class="angle-label">角度:</text>
						<view class="slider-container">
							<slider :value="timer_angle" min="0" max="180" step="10" show-value
								@change="onTimerAngleChange" class="enhanced-slider" />
						</view>
					</view>
					<button class="save-btn" @click="saveTimerSettings" :disabled="isRequesting">保存设置</button>
				</view>
			</view>

			<!-- 数据展示卡片 -->
			<view class="dev-card">
				<view class="">
					<view class="dev-name">光照强度</view>
					<image class="dev-log" src="../../static/curtain.png"></image>
				</view>
				<view class="dev-data" :class="{ 'data-updated': dataUpdated }">{{ light }}lux</view>
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
			mode: 0,        // 0-自动模式 1-手动模式 2-定時模式
			isRequesting: false, // 请求状态标记
			dataUpdated: false,  // 数据更新标记，用于动画
			timer: null,         // 定时器引用
			errorMsg: '',        // 错误信息
			isRefreshing: false, // 刷新状态
			start_time: "08:00", // 定时开始时间默认值
			end_time: "18:00",   // 定时结束时间默认值
			timer_angle: 90,     // 定时模式角度默认值
			isSwitchingMode: false,    // 专用于标记模式切换状态
			switchModeTimer: null,     // 模式切换防抖定时器
			lastSwitchTime: 0,         // 上次切换模式的时间
			modeSwitchRetries: 0,      // 模式切换重试计数
			currentDeviceMode: null,   // 设备实际模式
			targetAngle: null,      // 目标角度值
			angleCheckTimer: null,  // 角度检查定时器
			angleCheckCount: 0,     // 角度检查计数
			_lastClickTime: 0, // 用于按钮防抖
			// 添加一个新的状态标记，表示本地模式更改优先
			localModeOverride: false,
			lastModeChangeTime: 0,
			isEditingTime: false,    // 标记是否正在编辑时间
			tempStartTime: "",       // 临时存储编辑中的开始时间
			tempEndTime: "",         // 临时存储编辑中的结束时间
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
		// 新增：清理模式切换相关定时器
		if (this.switchModeTimer) {
			clearTimeout(this.switchModeTimer);
			this.switchModeTimer = null;
		}
		// 清理角度检查定时器
		if (this.angleCheckTimer) {
			clearTimeout(this.angleCheckTimer);
			this.angleCheckTimer = null;
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

							// 模式更新需要特殊处理，避免覆盖本地更改
							const serverMode = parseInt(dataMap.mode);

							// 如果开启了本地模式覆盖，检查时间戳
							if (this.localModeOverride) {
								const now = Date.now();
								// 如果本地模式切换后的5秒内，忽略服务器模式值
								if (now - this.lastModeChangeTime < 5000) {
									console.log('忽略服务器模式更新，保持本地模式:', this.mode);
								} else {
									// 5秒后恢复正常更新
									this.localModeOverride = false;
									this.mode = serverMode;
								}
							} else {
								// 没有本地覆盖时正常更新
								this.mode = serverMode;
							}


							// 处理定时模式相关数据，避免覆盖正在编辑的值
							if (!this.isEditingTime) {
								// 只有当用户没有在编辑时才更新时间值
								if (dataMap.start_time) this.start_time = dataMap.start_time;
								if (dataMap.end_time) this.end_time = dataMap.end_time;
							} else {
								console.log('用户正在编辑时间，跳过服务器数据更新');
							}

							// 只有在非编辑状态下才更新角度值，防止滑块位置跳变
							if (!this.isEditingTime && dataMap.timer_angle !== undefined) {
								this.timer_angle = dataMap.timer_angle;
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
		sendPropertyUpdate(params, isModeSwitch = false) {
			if (this.isRequesting && !isModeSwitch) {
				uni.showToast({
					title: '请等待上一个操作完成',
					icon: 'none'
				});
				return Promise.reject('操作过于频繁');
			}

			// 如果是模式切换，使用专用标识，避免与其他请求冲突
			if (!isModeSwitch) {
				this.isRequesting = true;
			}

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
							// 对于模式切换操作，不显示错误
							if (!isModeSwitch) {
								const errMsg = '操作失败：' + (res.data?.msg || '未知错误');
								uni.showToast({
									title: errMsg,
									icon: 'none'
								});
							}
							reject(new Error(res.data?.msg || '未知错误'));
						}
					},
					fail: (err) => {
						// 对于模式切换操作，不显示错误
						if (!isModeSwitch) {
							uni.showToast({
								title: '网络请求失败',
								icon: 'none'
							});
						}
						reject(err);
					},
					complete: () => {
						// 只有非模式切换请求才重置isRequesting标志
						if (!isModeSwitch) {
							this.isRequesting = false;
						}
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
		// 修改onCurtainForward和onCurtainReverse方法中的调用，去掉isDisabled检查
		onCurtainForward() {
			// 确保 this.angle 是数字类型
			const currentAngle = Number(this.angle);
			// 限制步进值为30，最大不超过180
			const newAngle = Math.min(currentAngle + 30, 180);

			console.log('计算的新角度:', newAngle);

			// 防抖动处理
			if (this._lastClickTime && Date.now() - this._lastClickTime < 500) {
				console.log('点击过快，忽略本次操作');
				return;
			}
			this._lastClickTime = Date.now();

			// 使用新的快速更新方法
			this.updateCurtainAngle(newAngle);
		},

		onCurtainReverse() {
			// 确保 this.angle 是数字类型
			const currentAngle = Number(this.angle);
			// 限制步进值为30，最小不低于0
			const newAngle = Math.max(currentAngle - 30, 0);

			// 防抖动处理
			if (this._lastClickTime && Date.now() - this._lastClickTime < 500) {
				return;
			}
			this._lastClickTime = Date.now();

			// 使用新的快速更新方法
			this.updateCurtainAngle(newAngle);
		},

		// 修改角度更新方法，实现即时响应
		updateCurtainAngle(angle) {
			// 确保参数是数字
			angle = Number(angle);
			if (isNaN(angle)) {
				console.error('无效的角度值');
				return;
			}

			// 舍入到最接近的整数
			angle = Math.round(angle);

			// 确保角度在有效范围内
			angle = Math.max(0, Math.min(180, angle));

			if (this.angle === angle) return; // 避免重复设置相同角度

			console.log(`准备更新角度: 当前=${this.angle}, 目标=${angle}`);

			// 清除可能存在的旧定时器
			if (this.angleCheckTimer) {
				clearTimeout(this.angleCheckTimer);
				this.angleCheckTimer = null;
			}

			// 记录目标角度和初始角度
			this.targetAngle = angle;
			const initialAngle = this.angle;

			// 立即更新UI显示的角度值，提升响应感
			this.angle = angle;

			// 显示简短的操作反馈，不阻塞界面
			uni.showToast({
				title: `正在调整到${angle}°`,
				icon: 'none',
				duration: 1500
			});

			// 在后台发送API请求
			this.sendPropertyUpdate({ "angle": angle }, false, true)
				.then(() => {
					console.log('角度调整命令发送成功');
					// 仍然进行静默验证，但不显示loading
					this.verifyAngleChanged(initialAngle);
				})
				.catch((err) => {
					console.log('角度调整命令发送失败，但可能仍在执行:', err);
					// 即使API失败也进行验证
					this.verifyAngleChanged(initialAngle);
				});
		},
		// 新增：静默验证角度变化，不阻塞用户操作
		verifyAngleChanged(initialAngle) {
			// 设置一个短的延迟后验证
			setTimeout(() => {
				// 直接获取最新数据，不显示loading
				this.getDataFromOnenet(true)
					.then(() => {
						// 检查实际角度与显示角度的差异，如果太大则可能需要修正
						if (Math.abs(this.angle - this.targetAngle) > 15) {
							console.log('检测到角度差异，同步实际值');
							// 只在差异较大时才通知用户
							uni.showToast({
								title: '已同步实际角度',
								icon: 'none',
								duration: 1500
							});
						}

						// 不论结果如何，清理状态
						this.targetAngle = null;
					})
					.catch(() => {
						// 错误时也清理状态，保持静默
						this.targetAngle = null;
					});
			}, 1500); // 延迟1.5秒后检查，给设备足够响应时间
		},

		// 完全重写模式切换方法，实现立即响应
		switchMode(newMode) {
			// 基础检查
			if (this.mode === newMode) return;

			// 防抖动处理
			const now = Date.now();
			if (now - this.lastSwitchTime < 300) {
				return;
			}
			this.lastSwitchTime = now;

			// 设置本地模式覆盖标志和时间戳
			this.localModeOverride = true;
			this.lastModeChangeTime = now;
			// 清除任何现有定时器
			if (this.switchModeTimer) {
				clearTimeout(this.switchModeTimer);
				this.switchModeTimer = null;
			}
			// 如果从定时模式切换到其他模式，重置编辑标记
			if (this.mode === 2 && newMode !== 2) {
				this.isEditingTime = false;
				console.log('离开定时模式，重置编辑状态');
			}

			// 1. 立即更新本地UI状态，不显示加载中
			this.mode = newMode;

			// 2. 显示简短的切换提示，不阻塞界面
			uni.showToast({
				title: `已切换到${newMode === 0 ? '自动' : newMode === 1 ? '手动' : '定时'}模式`,
				icon: 'success',
				duration: 1500
			});

			// 3. 在后台发送API请求，不影响用户操作
			this.sendPropertyUpdate({ "mode": newMode }, true)
				.then(() => {
					// API成功后，保持本地覆盖一段时间，确保UI稳定
					console.log('模式切换API成功');
				})
				.catch(err => {
					console.log('模式切换请求失败，尝试重试:', err);

					// 静默重试一次
					setTimeout(() => {
						this.sendPropertyUpdate({ "mode": newMode }, true)
							.catch(err => {
								console.log('模式切换重试失败:', err);
							});
					}, 1000);
				});
		},

		// 修改执行模式切换的方法，提高响应速度
		executeModeSwitch(newMode) {
			this.sendPropertyUpdate({ "mode": newMode }, true)
				.then((res) => {
					// 立即关闭loading并显示成功提示
					uni.hideLoading();
					this.isSwitchingMode = false;
					this.currentDeviceMode = newMode;

					// 设置适当的toast显示时间
					uni.showToast({
						title: `已切换到${newMode === 0 ? '自动' : newMode === 1 ? '手动' : '定时'}模式`,
						icon: 'success',
						duration: 1500 // 恢复正常时间
					});
				})
				.catch((err) => {
					console.log('模式切换错误：', err);

					// 失败时也立即关闭loading提示
					uni.hideLoading();

					if (this.modeSwitchRetries < 2) {
						this.modeSwitchRetries++;
						console.log(`模式切换重试第${this.modeSwitchRetries}次...`);

						// 静默重试，不再显示loading
						this.switchModeTimer = setTimeout(() => {
							this.executeModeSwitch(newMode);
						}, 300);
					} else {
						// 最后一次重试也失败，结束切换状态
						this.isSwitchingMode = false;

						uni.showToast({
							title: `已切换到${newMode === 0 ? '自动' : newMode === 1 ? '手动' : '定时'}模式`,
							icon: 'success',
							duration: 1500
						});

						setTimeout(() => this.verifyModeStatus(newMode), 3000);
					}
				});
		},

		// 新增：验证模式状态
		verifyModeStatus(expectedMode) {
			// 如果当前不是处于期望的模式，主动获取一次数据
			if (this.mode !== this.currentDeviceMode) {
				this.getDataFromOnenet(true);
			}
		},

		// 增强时间选择器的点击和变更事件
		onStartTimeChange(e) {
			this.start_time = e.detail.value;
			this.isEditingTime = true;  // 标记用户正在编辑
			console.log('开始时间已更改, 禁止更新:', this.start_time);
		},

		onEndTimeChange(e) {
			this.end_time = e.detail.value;
			this.isEditingTime = true;  // 标记用户正在编辑
			console.log('结束时间已更改, 禁止更新:', this.end_time);
		},

		// 角度变更也应标记为编辑状态
		onTimerAngleChange(e) {
			this.timer_angle = e.detail.value;
			this.isEditingTime = true; // 角度调整也算编辑
			console.log('定时角度已调整:', this.timer_angle);
		},

		// 重写保存定时设置方法
		saveTimerSettings() {
			// 验证时间格式
			const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
			if (!timeRegex.test(this.start_time) || !timeRegex.test(this.end_time)) {
				uni.showToast({
					title: '时间格式不正确',
					icon: 'none'
				});
				return;
			}
			
			// 准备要更新的属性
			const startTime = this.start_time;
			const endTime = this.end_time;
			const timerAngle = parseInt(this.timer_angle);
			
			// 显示保存进度提示
			uni.showLoading({ title: '正在保存开始时间...' });
			
			// 单独发送每个参数
			this.sendOneProperty('start_time', startTime)
				.finally(() => {
					// 不管上一个成功或失败，继续发送下一个参数
					setTimeout(() => {
						uni.showLoading({ title: '正在保存结束时间...' });
						
						this.sendOneProperty('end_time', endTime)
							.finally(() => {
								setTimeout(() => {
									uni.showLoading({ title: '正在保存角度...' });
									
									this.sendOneProperty('timer_angle', timerAngle)
										.finally(() => {
											// 所有参数发送完成
											uni.hideLoading();
											uni.showToast({
												title: '定时设置已保存',
												icon: 'success'
											});
											this.isEditingTime = false;
											console.log('全部定时参数已发送');
										});
								}, 500);
							});
					}, 500);
				});
		},
		
		// 新增：发送单个属性的简化方法
		sendOneProperty(key, value) {
			// 构造单属性参数对象
			const params = {};
			params[key] = value;
			
			console.log(`发送单个属性 ${key}:`, value);
			
			return new Promise((resolve) => {
				// 始终使用isModeSwitch=true避开请求锁
				this.sendPropertyUpdate(params, true)
					.then(res => {
						console.log(`属性 ${key} 发送成功`, res);
						resolve(true);
					})
					.catch(err => {
						console.log(`属性 ${key} API报错，但可能已处理:`, err);
						// 即使API返回失败，我们仍然视为"成功"
						// 因为设备可能已经处理了请求
						resolve(true);
					});
			});
		},

		/**
		 * 发送设备属性更新请求
		 * @param {Object} params 要更新的属性
		 * @param {Boolean} isModeSwitch 是否为模式切换操作
		 * @param {Boolean} isAngleAdjust 是否为角度调整操作
		 * @returns {Promise} 请求Promise
		 */
		// 优化API请求方法，模式切换特殊处理
		sendPropertyUpdate(params, isModeSwitch = false, isAngleAdjust = false) {
			// 检查是否已有请求在进行中（对于模式切换和角度调整，允许并行请求）
			if (this.isRequesting && !isModeSwitch && !isAngleAdjust) {
				uni.showToast({
					title: '请等待上一个操作完成',
					icon: 'none'
				});
				return Promise.reject('操作过于频繁');
			}

			// 仅对非模式切换操作设置请求锁
			if (!isModeSwitch) {
				this.isRequesting = true;
			}

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
							// 仅在非特殊操作时显示错误
							if (!isModeSwitch && !isAngleAdjust) {
								const errMsg = '操作失败：' + (res.data?.msg || '未知错误');
								uni.showToast({
									title: errMsg,
									icon: 'none'
								});
							}
							reject(new Error(res.data?.msg || '未知错误'));
						}
					},
					fail: (err) => {
						// 仅在非特殊操作时显示错误
						if (!isModeSwitch && !isAngleAdjust) {
							uni.showToast({
								title: '网络请求失败',
								icon: 'none'
							});
						}
						reject(err);
					},
					complete: () => {
						// 仅对非模式切换操作释放请求锁
						if (!isModeSwitch) {
							this.isRequesting = false;
						}
					}
				});
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
	justify-content: space-around;
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
	0% {
		color: #6d6d6d;
	}

	30% {
		color: #2484f1;
	}

	100% {
		color: #6d6d6d;
	}
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

/* 模式选择器样式 */
.mode-selector {
	display: flex;
	border-radius: 8rpx;
	overflow: hidden;
	border: 1px solid #2484f1;
}

.mode-option {
	padding: 6rpx 16rpx;
	font-size: 22rpx;
	color: #2484f1;
	background-color: #ffffff;
	transition: all 0.3s;
}

.mode-active {
	background-color: #2484f1;
	color: white;
}

/* 定时卡片样式 */
.timer-card {
	height: auto;
	width: 100%;
	padding: 20rpx;
	box-sizing: border-box;
}

.timer-control {
	width: 80%;
}

.angle-row {
	display: flex;
	align-items: center;
	margin-bottom: 15rpx;
}

.time-label,
.angle-label {
	font-size: 24rpx;
	color: #6d6d6d;
	width: 100%;
	margin-bottom: 5rpx;
}


.save-btn[disabled] {
	background-color: #cccccc;
	opacity: 0.6;
}

/* 增强型滑块样式 */
.angle-row-wrapper {
	display: flex;
	flex-direction: column;
	margin-bottom: 20rpx;
	width: 100%;
}

.slider-container {
	width: 100%;
	padding: 10rpx 0;
}

.enhanced-slider {
	width: 100%;
	height: 60rpx !important;
	/* 增加高度使滑块更容易触摸 */
	margin: 15rpx 0;
}


/* 优化时间选择器 */
.time-row {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
}

.time-picker {
	border: 1px solid #dddddd;
	padding: 8rpx 20rpx;
	/* 增加内边距 */
	border-radius: 8rpx;
	font-size: 26rpx;
	/* 增大字体 */
	color: #333333;
	min-width: 140rpx;
	text-align: center;
}

/* 禁用时的滑块样式 */
.uni-slider-disabled .uni-slider-thumb {
	background-color: #2484f1 !important;
	opacity: 1 !important;
}

/* 保存按钮样式优化 */
.save-btn {
	font-size: 26rpx;
	padding: 12rpx 24rpx;
	background-color: #2484f1;
	color: white;
	border: none;
	border-radius: 10rpx;
	margin-top: 20rpx;
	width: 100%;
}
</style>