<template>
	<view class="container">
		<view class="header">
			<view class="header-content">
				<text class="title">历史记录</text>
				<view class="clear-btn-wrapper" @tap="clearHistory">
					<text class="clear-icon">🗑</text>
					<text class="clear-text">清空</text>
				</view>
			</view>
		</view>
		
		<scroll-view 
			scroll-y 
			class="history-list"
			:refresher-enabled="true"
			:refresher-triggered="isRefreshing"
			@refresherpulling="onPulling"
			@refresherrefresh="onRefresh"
		>
			<view v-if="historyList.length === 0" class="empty-state">
				<text class="empty-icon">📜</text>
				<text class="empty-text">暂无浏览记录</text>
				<text class="empty-tip">浏览的文章会显示在这里</text>
			</view>
			
			<view v-else class="history-content">
				<view 
					v-for="(item, index) in historyList" 
					:key="index" 
					class="history-item"
					:class="{ 'history-item-active': activeIndex === index }"
					@tap="openWikiPage(item.url, index)"
				>
					<view class="item-main">
						<image class="item-image" :src="item.image" mode="aspectFill">
							<view class="image-placeholder" v-if="!item.image">
								<text class="placeholder-text">Wiki</text>
							</view>
						</image>
						<view class="item-content">
							<text class="item-title">{{item.title}}</text>
							<text class="item-excerpt">{{item.excerpt}}</text>
						</view>
					</view>
					<view class="item-footer">
						<text class="item-time">{{new Date(item.timestamp).toLocaleString('zh-CN', {
							year: 'numeric',
							month: '2-digit', 
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false
						})}}</text>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				historyList: [],
				statusBarHeight: 0,
				isRefreshing: false,
				activeIndex: -1
			}
		},
		onLoad() {
			// 获取状态栏高度
			this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight
		},
		onShow() {
			this.loadHistory()
		},
		methods: {
			loadHistory() {
				try {
					const history = uni.getStorageSync('wikiHistory') || []
					this.historyList = history.reverse().map(item => ({
						...item,
						timestamp: item.timestamp || Date.now()
					}))
				} catch (e) {
					console.error('加载历史记录失败:', e)
					uni.showToast({
						title: '加载历史记录失败',
						icon: 'none'
					})
				}
			},
			clearHistory() {
				uni.showModal({
					title: '清空历史记录',
					content: '确定要清空所有历史记录吗？',
					confirmColor: '#ff5a5f',
					success: (res) => {
						if (res.confirm) {
							try {
								uni.removeStorageSync('wikiHistory')
								this.historyList = []
								uni.showToast({
									title: '已清空',
									icon: 'success'
								})
							} catch (e) {
								console.error('清空历史记录失败:', e)
								uni.showToast({
									title: '操作失败',
									icon: 'none'
								})
							}
						}
					}
				})
			},
			openWikiPage(url, index) {
				this.activeIndex = index
				setTimeout(() => {
					uni.navigateTo({
						url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
					})
				}, 150)
			},
			formatTime(timestamp) {
				const date = new Date(timestamp)
				const now = new Date()
				const diff = now - date
				
				// 小于1小时
				if (diff < 3600000) {
					const minutes = Math.floor(diff / 60000)
					return `${minutes}分钟前`
				}
				// 小于24小时
				if (diff < 86400000) {
					const hours = Math.floor(diff / 3600000)
					return `${hours}小时前`
				}
				// 小于7天
				if (diff < 604800000) {
					const days = Math.floor(diff / 86400000)
					return `${days}天前`
				}
				// 其他情况显示具体日期
				return `${date.getMonth() + 1}月${date.getDate()}日`
			},
			onPulling() {
				// 下拉刷新的操作
			},
			async onRefresh() {
				this.isRefreshing = true
				await this.loadHistory()
				setTimeout(() => {
					this.isRefreshing = false
				}, 1000)
			}
		}
	}
</script>

<style>
	.container {
		flex: 1;
		background-color: #000;
		min-height: 100vh;
	}
	
	.status-bar {
		background-color: #000;
		height: var(--status-bar-height);
	}
	
	.header {
		background: rgba(0,0,0,0.8);
		backdrop-filter: blur(20px);
		position: sticky;
		top: 0;
		z-index: 100;
	}
	
	.header-content {
		padding: min(1.5vw, 16rpx) min(4vw, 40rpx);
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 88rpx;
	}
	
	.title {
		font-size: min(max(3.2vw, 26rpx), 42rpx);
		font-weight: 600;
		color: #ffffff;
		letter-spacing: 0.5px;
	}
	
	.clear-btn-wrapper {
		display: flex;
		align-items: center;
		background: rgba(255,90,95,0.1);
		padding: min(1.5vw, 16rpx) min(2.5vw, 24rpx);
		border-radius: 100rpx;
		transition: all 0.3s ease;
		height: min(5vw, 52rpx);
	}
	
	.clear-btn-wrapper:active {
		transform: scale(0.95);
		background: rgba(255,90,95,0.2);
	}
	
	.clear-icon {
		font-size: min(max(2.6vw, 22rpx), 28rpx);
		margin-right: 4rpx;
	}
	
	.clear-text {
		font-size: min(max(2.6vw, 22rpx), 28rpx);
		color: #ff5a5f;
	}
	
	.history-list {
		height: calc(100vh - var(--status-bar-height) - 88rpx);
	}
	
	.history-content {
		padding: min(2vw, 20rpx);
	}
	
	.empty-state {
		padding: min(6vw, 60rpx);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
	}
	
	.empty-icon {
		font-size: min(max(8vw, 80rpx), 120rpx);
		margin-bottom: min(4vw, 40rpx);
	}
	
	.empty-text {
		font-size: min(max(3.2vw, 28rpx), 36rpx);
		color: rgba(255,255,255,0.8);
		margin-bottom: min(2vw, 20rpx);
	}
	
	.empty-tip {
		font-size: min(max(2.4vw, 20rpx), 26rpx);
		color: rgba(255,255,255,0.4);
	}
	
	.history-item {
		margin: min(2vw, 20rpx) 0;
		background: rgba(255,255,255,0.05);
		border-radius: min(3vw, 30rpx);
		overflow: hidden;
		transition: all 0.3s ease;
	}
	
	.history-item-active {
		transform: scale(0.98);
		background: rgba(255,255,255,0.1);
	}
	
	.item-main {
		display: flex;
		padding: min(3vw, 30rpx);
	}
	
	.item-image {
		width: min(20vw, 200rpx);
		height: min(20vw, 200rpx);
		border-radius: min(2vw, 20rpx);
		background: rgba(255,255,255,0.1);
		position: relative;
	}
	
	.image-placeholder {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(45deg, #2c3e50, #3498db);
	}
	
	.placeholder-text {
		color: rgba(255,255,255,0.8);
		font-size: min(max(2.8vw, 24rpx), 30rpx);
		font-weight: 500;
	}
	
	.item-content {
		flex: 1;
		margin-left: min(3vw, 30rpx);
		overflow: hidden;
	}
	
	.item-title {
		font-size: min(max(2.8vw, 24rpx), 30rpx);
		font-weight: 500;
		color: #ffffff;
		margin-bottom: min(1.5vw, 15rpx);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		line-height: 1.4;
	}
	
	.item-excerpt {
		font-size: min(max(2.4vw, 20rpx), 26rpx);
		color: rgba(255,255,255,0.6);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		line-height: 1.4;
	}
	
	.item-footer {
		padding: min(2vw, 20rpx) min(3vw, 30rpx);
		border-top: 1px solid rgba(255,255,255,0.05);
	}
	
	.item-time {
		font-size: min(max(2.2vw, 18rpx), 24rpx);
		color: rgba(255,255,255,0.4);
	}

	/* 小屏幕设备样式 */
	@media screen and (max-width: 375px) {
		.title {
			font-size: 38rpx;
		}
		
		.clear-text, .clear-icon {
			font-size: 26rpx;
		}
		
		.empty-text {
			font-size: 36rpx;
		}
		
		.empty-tip {
			font-size: 28rpx;
		}
		
		.item-title {
			font-size: 34rpx;
		}
		
		.item-excerpt {
			font-size: 28rpx;
		}
		
		.item-time {
			font-size: 24rpx;
		}
	}
</style> 