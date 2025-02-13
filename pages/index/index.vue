<template>
	<view class="container">
		<template v-if="wikiItems.length > 0">
			<swiper 
				class="swiper" 
				vertical 
				@change="onSwiperChange" 
				@animationfinish="onAnimationFinish"
				:current="currentIndex" 
				:disable-touch="isLoading || isLoadingMore"
				:duration="200"
				:circular="true"
				:skip-hidden-item-layout="true"
			>
				<swiper-item v-for="(item, index) in wikiItems" :key="item.url">
					<view class="wiki-item" :class="{ 'wiki-item-active': index === currentIndex }">
						<image 
							class="background-image" 
							:src="item.image" 
							mode="aspectFill" 
							@error="handleImageError(item)"
							:lazy-load="true"
						></image>
						<view class="content-overlay">
							<view class="top-bar" :style="{ top: statusBarHeight + 'px' }">
								<view class="language-selector">
									<picker 
										@change="onLanguageChange" 
										:value="currentLanguageIndex" 
										:range="languages.names" 
										@tap.stop
										:disabled="isLoading || isLoadingMore"
									>
										<text class="language-text">{{languages.names[currentLanguageIndex]}}</text>
									</picker>
								</view>
								<view class="history-btn" @tap="openHistory">
									<text class="history-text">历史</text>
								</view>
							</view>
							<view class="wiki-content" @tap.stop="openWikiPage(item.url)">
								<text class="wiki-title">{{item.title}}</text>
								<text class="wiki-excerpt">{{item.excerpt}}</text>
								<view class="loading-overlay" v-if="isLoadingMore && index === wikiItems.length - 1">
									<text class="loading-text">正在加载更多...</text>
								</view>
							</view>
						</view>
					</view>
				</swiper-item>
			</swiper>
		</template>
		<view class="loading-indicator" v-if="isLoading">
			<text class="loading-text">加载中...</text>
		</view>
	</view>
</template>

<script>
// 常量配置
const CONFIG = {
	INITIAL_LOAD_COUNT: 3,
	MAX_HISTORY_ITEMS: 100,
	MAX_DISPLAY_ITEMS: 10,
	REQUEST_TIMEOUT: 10000,
	MAX_RETRIES: 5,
	RETRY_DELAY: 1000,
	PRELOAD_THRESHOLD: 2
}

// Wiki API 服务
const WikiService = {
	async fetchRandomArticle(langCode) {
		const url = `https://${langCode}.wikipedia.org/api/rest_v1/page/random/summary`
		const headers = {
			'User-Agent': 'WikiTok/1.0 (https://github.com/your-username/wikitok; your-email@example.com) UniApp/3.0',
			'Accept': 'application/json',
			'Accept-Language': langCode
		}
		
		try {
			const response = await Promise.race([
				uni.request({ url, method: 'GET', header: headers }),
				new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), CONFIG.REQUEST_TIMEOUT))
			])
			
			if (!response.data || response.statusCode !== 200) {
				throw new Error(`API响应错误: ${response.statusCode}`)
			}
			
			return response.data
		} catch (error) {
			console.error('Wiki API请求失败:', error)
			throw error
		}
	}
}

// 工具函数
const utils = {
	validateWikiData(data) {
		return Boolean(
			data?.title &&
			data?.extract &&
			data?.content_urls?.desktop?.page &&
			typeof data.title === 'string' &&
			typeof data.extract === 'string' &&
			typeof data.content_urls.desktop.page === 'string'
		)
	},
	
	processImageUrl(url) {
		if (!url) return '/static/default-bg.jpg'
		
		try {
			// 简化URL处理逻辑，只确保使用HTTPS
			return url.replace(/^http:/, 'https:')
		} catch (e) {
			console.error('图片URL处理失败:', e)
			return '/static/default-bg.jpg'
		}
	},
	
	getBestImageUrl(data) {
		if (!data.thumbnail) return null
		// 优先使用较大的图片
		if (data.originalimage?.source) {
			return data.originalimage.source
		}
		// 如果有缩略图但没有原图，尝试获取更大的缩略图
		if (data.thumbnail.source) {
			return data.thumbnail.source.replace(/\/\d+px-/, '/800px-')
		}
		return null
	}
}

export default {
	data() {
		return {
			wikiItems: [],
			languages: {
				names: ['中文', 'English', 'Español', 'Français', '日本語', 'Deutsch', 'Italiano', 'Português', 'Русский', '한국어', 'العربية', 'हिन्दी', 'Nederlands', 'Polski', 'Svenska', 'Українська', 'Tiếng Việt', 'ไทย'],
				codes: ['zh', 'en', 'es', 'fr', 'ja', 'de', 'it', 'pt', 'ru', 'ko', 'ar', 'hi', 'nl', 'pl', 'sv', 'uk', 'vi', 'th']
			},
			currentLanguageIndex: 0,
			isLoading: false,
			currentIndex: 0,
			statusBarHeight: 20,
			retryCount: 0,
			isLoadingMore: false,
			isInitialized: false
		}
	},
	
	computed: {
		currentLanguageCode() {
			return this.languages.codes[this.currentLanguageIndex]
		}
	},
	
	async onLoad() {
		this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight
		await this.loadInitialData()
	},
	
	methods: {
		// 数据加载相关方法
		async loadInitialData() {
			this.isLoading = true
			this.wikiItems = [] // 清空现有数据
			this.currentIndex = 0
			
			try {
				const articles = []
				for(let i = 0; i < CONFIG.INITIAL_LOAD_COUNT; i++) {
					const article = await this.fetchArticleWithRetry()
					if (article) {
						articles.push(article)
					}
				}
				
				if (articles.length > 0) {
					await this.$nextTick()
					this.wikiItems = articles
					this.currentIndex = 0
					this.isInitialized = true
				}
			} catch (error) {
				this.handleLoadError(error)
			} finally {
				this.isLoading = false
			}
		},
		
		async fetchArticleWithRetry() {
			let retryCount = 0
			
			while (retryCount < CONFIG.MAX_RETRIES) {
				try {
					const data = await WikiService.fetchRandomArticle(this.currentLanguageCode)
					
					if (!utils.validateWikiData(data)) {
						throw new Error('无效的维基数据结构')
					}
					
					return this.transformWikiData(data)
				} catch (error) {
					retryCount++
					if (retryCount === CONFIG.MAX_RETRIES) throw error
					
					console.log(`正在进行第 ${retryCount} 次重试...`)
					await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY))
				}
			}
		},
		
		transformWikiData(data) {
			const imageUrl = utils.getBestImageUrl(data)
			const processedImageUrl = utils.processImageUrl(imageUrl)
			
			return {
				title: data.title,
				excerpt: data.extract,
				image: processedImageUrl || '/static/default-bg.jpg', // 确保始终有图片
				url: data.content_urls.desktop.page
			}
		},
		
		handleLoadError(error) {
			console.error('加载文章失败:', error)
			uni.showToast({
				title: error.message || '加载失败，请检查网络',
				icon: 'none',
				duration: 2000
			})
		},
		
		// 历史记录相关方法
		saveToHistory(item) {
			if (!item) return
			try {
				let history = uni.getStorageSync('wikiHistory') || []
				// 检查是否已存在
				if (!history.some(h => h.url === item.url)) {
					// 添加时间戳并保存
					const itemWithTimestamp = {
						...item,
						timestamp: Date.now()
					}
					history = [...history, itemWithTimestamp].slice(0, CONFIG.MAX_HISTORY_ITEMS)
					uni.setStorageSync('wikiHistory', history)
				}
			} catch (e) {
				console.error('保存历史记录失败:', e)
			}
		},
		
		// 事件处理方法
		onLanguageChange(e) {
			this.currentLanguageIndex = e.detail.value
			this.wikiItems = []
			this.currentIndex = 0
			this.loadInitialData()
		},
		
		async onSwiperChange(e) {
			const newIndex = e.detail.current
			if (newIndex === this.currentIndex) return
			
			// 保存当前查看的条目到历史记录
			this.saveToHistory(this.wikiItems[newIndex])
			
			// 更新当前索引
			this.currentIndex = newIndex
			
			// 检查是否需要加载更多内容
			await this.checkAndLoadMore()
		},
		
		onAnimationFinish() {
			// 动画完成后，如果需要加载更多内容，开始加载
			if (!this.isLoadingMore && this.currentIndex >= this.wikiItems.length - CONFIG.PRELOAD_THRESHOLD) {
				this.checkAndLoadMore()
			}
		},
		
		async checkAndLoadMore() {
			// 如果正在加载，则跳过
			if (this.isLoadingMore) return
			
			// 计算还剩多少条未查看的内容
			const remainingItems = this.wikiItems.length - (this.currentIndex + 1)
			
			// 如果剩余条数小于预加载阈值，则加载更多
			if (remainingItems < CONFIG.PRELOAD_THRESHOLD) {
				this.isLoadingMore = true
				try {
					const article = await this.fetchArticleWithRetry()
					if (article) {
						// 添加新内容
						this.wikiItems.push(article)
						
						// 如果超出最大显示数量，从头部删除
						if (this.wikiItems.length > CONFIG.MAX_DISPLAY_ITEMS) {
							this.wikiItems = this.wikiItems.slice(-CONFIG.MAX_DISPLAY_ITEMS)
							// 调整当前索引
							this.currentIndex = Math.max(0, this.currentIndex - 1)
						}
					}
				} catch (error) {
					this.handleLoadError(error)
				} finally {
					this.isLoadingMore = false
				}
			}
		},
		
		openWikiPage(url) {
			uni.navigateTo({
				url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
			})
		},
		
		openHistory() {
			uni.navigateTo({
				url: '/pages/profile/profile'
			})
		},
		
		handleImageError(item) {
			if (item) {
				item.image = '/static/default-bg.jpg'
			}
		}
	},
	
	watch: {
		wikiItems: {
			handler(newVal, oldVal) {
				if (oldVal.length === 0 && newVal.length > 0) {
					this.$nextTick(() => {
						this.currentIndex = 0
					})
				}
			},
			deep: true
		}
	}
}
</script>

<style>
	.container {
		width: 100vw;
		height: 100vh;
		background-color: #000;
		padding-top: constant(safe-area-inset-top);
		padding-top: env(safe-area-inset-top);
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.swiper {
		width: 100%;
		height: 100%;
		background-color: #000;
	}

	.wiki-item {
		position: relative;
		width: 100%;
		height: 100%;
		transform: scale(0.98);
		transition: transform 0.3s ease;
		max-width: 100%;
		margin: 0 auto;
	}

	.wiki-item-active {
		transform: scale(1);
	}

	.background-image {
		width: 100%;
		height: 100%;
		position: absolute;
		object-fit: cover;
		background-color: #000;
		transition: opacity 0.3s ease;
	}

	.content-overlay {
		position: absolute;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			to bottom,
			rgba(0,0,0,0.2) 0%,
			rgba(0,0,0,0.3) 50%,
			rgba(0,0,0,0.8) 100%
		);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 4vw;
		box-sizing: border-box;
		transition: opacity 0.3s ease;
	}

	.top-bar {
		position: fixed;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 4vw;
		z-index: 2;
	}

	.wiki-content {
		margin-top: auto;
		padding: min(4vw, 40rpx);
		position: relative;
		z-index: 1;
		background: linear-gradient(
			to bottom,
			rgba(0,0,0,0) 0%,
			rgba(0,0,0,0.7) 30%,
			rgba(0,0,0,0.8) 100%
		);
		border-radius: min(2vw, 20rpx);
		max-width: 1200rpx;
		margin-left: auto;
		margin-right: auto;
	}

	.wiki-title {
		display: block;
		color: #ffffff;
		font-size: min(max(3.5vw, 28rpx), 48rpx);
		font-weight: bold;
		margin-bottom: min(3vw, 30rpx);
		text-shadow: 0 2px 4px rgba(0,0,0,0.5);
		line-height: 1.4;
	}

	.wiki-excerpt {
		display: block;
		color: rgba(255,255,255,0.9);
		font-size: min(max(2.8vw, 24rpx), 30rpx);
		line-height: 1.6;
		text-shadow: 0 1px 2px rgba(0,0,0,0.5);
	}

	.loading-overlay {
		position: absolute;
		bottom: min(4vw, 40rpx);
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0,0,0,0.6);
		padding: min(1.5vw, 12rpx) min(2.5vw, 24rpx);
		border-radius: min(3vw, 30rpx);
		z-index: 2;
	}

	.loading-text {
		color: #ffffff;
		font-size: min(2.8vw, 26rpx);
	}

	.loading-indicator {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0,0,0,0.8);
		padding: min(2vw, 20rpx) min(3vw, 30rpx);
		border-radius: min(4vw, 40rpx);
		z-index: 999;
	}

	/* 默认样式 */
	.loading-text {
		font-size: 24rpx;
	}

	.wiki-title {
		font-size: 24rpx;
	}

	.wiki-excerpt {
		font-size: 20rpx;
	}
	
	.history-btn,.language-selector {
		background: rgba(0,0,0,0.6);
		text-align: center;
		height: 30rpx;
		line-height: 30rpx;
		border-radius: 100rpx;
		backdrop-filter: blur(10px);
		padding: 0 10rpx;
		padding-bottom: 6rpx;
	}

	.history-text,.language-text {
		color: #ffffff;
		font-size: 18rpx;
	}

	/* 小屏幕设备样式 */
	@media screen and (max-width: 375px) {
		.loading-text {
			font-size: 32rpx;
		}

		.wiki-title {
			font-size: 46rpx;
		}

		.wiki-excerpt {
			font-size: 36rpx;
		}
	
		.history-btn,.language-selector {
			background: rgba(0,0,0,0.6);
			text-align: center;
			height: 60rpx;
			line-height: 60rpx;
			border-radius: 100rpx;
			backdrop-filter: blur(10px);
			padding: 4rpx 20rpx;
			padding-bottom: 0rpx;
		}

		.history-text,.language-text {
			color: #ffffff;
			font-size: 34rpx;
		}
	}
	
	/* 额外的安全区域处理 */
	@supports (padding-top: env(safe-area-inset-top)) {
		.container {
			padding-top: env(safe-area-inset-top);
			padding-bottom: env(safe-area-inset-bottom);
		}
		
		.top-bar {
			padding-top: env(safe-area-inset-top);
		}
	}
</style>

