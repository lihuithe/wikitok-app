if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const CONFIG = {
    INITIAL_LOAD_COUNT: 3,
    MAX_HISTORY_ITEMS: 100,
    MAX_DISPLAY_ITEMS: 10,
    REQUEST_TIMEOUT: 1e4,
    MAX_RETRIES: 5,
    RETRY_DELAY: 1e3,
    PRELOAD_THRESHOLD: 2
  };
  const WikiService = {
    async fetchRandomArticle(langCode) {
      const url = `https://${langCode}.wikipedia.org/api/rest_v1/page/random/summary`;
      const headers = {
        "User-Agent": "WikiTok/1.0 (https://github.com/your-username/wikitok; your-email@example.com) UniApp/3.0",
        "Accept": "application/json",
        "Accept-Language": langCode
      };
      try {
        const response = await Promise.race([
          uni.request({ url, method: "GET", header: headers }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("请求超时")), CONFIG.REQUEST_TIMEOUT))
        ]);
        if (!response.data || response.statusCode !== 200) {
          throw new Error(`API响应错误: ${response.statusCode}`);
        }
        return response.data;
      } catch (error) {
        formatAppLog("error", "at pages/index/index.vue:93", "Wiki API请求失败:", error);
        throw error;
      }
    }
  };
  const utils = {
    validateWikiData(data) {
      var _a, _b;
      return Boolean(
        (data == null ? void 0 : data.title) && (data == null ? void 0 : data.extract) && ((_b = (_a = data == null ? void 0 : data.content_urls) == null ? void 0 : _a.desktop) == null ? void 0 : _b.page) && typeof data.title === "string" && typeof data.extract === "string" && typeof data.content_urls.desktop.page === "string"
      );
    },
    processImageUrl(url) {
      if (!url)
        return "/static/default-bg.jpg";
      try {
        return url.replace(/^http:/, "https:");
      } catch (e) {
        formatAppLog("error", "at pages/index/index.vue:119", "图片URL处理失败:", e);
        return "/static/default-bg.jpg";
      }
    },
    getBestImageUrl(data) {
      var _a;
      if (!data.thumbnail)
        return null;
      if ((_a = data.originalimage) == null ? void 0 : _a.source) {
        return data.originalimage.source;
      }
      if (data.thumbnail.source) {
        return data.thumbnail.source.replace(/\/\d+px-/, "/800px-");
      }
      return null;
    }
  };
  const _sfc_main$3 = {
    data() {
      return {
        wikiItems: [],
        languages: {
          names: ["中文", "English", "Español", "Français", "日本語", "Deutsch", "Italiano", "Português", "Русский", "한국어", "العربية", "हिन्दी", "Nederlands", "Polski", "Svenska", "Українська", "Tiếng Việt", "ไทย"],
          codes: ["zh", "en", "es", "fr", "ja", "de", "it", "pt", "ru", "ko", "ar", "hi", "nl", "pl", "sv", "uk", "vi", "th"]
        },
        currentLanguageIndex: 0,
        isLoading: false,
        currentIndex: 0,
        statusBarHeight: 20,
        retryCount: 0,
        isLoadingMore: false,
        isInitialized: false
      };
    },
    computed: {
      currentLanguageCode() {
        return this.languages.codes[this.currentLanguageIndex];
      }
    },
    async onLoad() {
      this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight;
      await this.loadInitialData();
    },
    methods: {
      // 数据加载相关方法
      async loadInitialData() {
        this.isLoading = true;
        this.wikiItems = [];
        this.currentIndex = 0;
        try {
          const articles = [];
          for (let i = 0; i < CONFIG.INITIAL_LOAD_COUNT; i++) {
            const article = await this.fetchArticleWithRetry();
            if (article) {
              articles.push(article);
            }
          }
          if (articles.length > 0) {
            await this.$nextTick();
            this.wikiItems = articles;
            this.currentIndex = 0;
            this.isInitialized = true;
          }
        } catch (error) {
          this.handleLoadError(error);
        } finally {
          this.isLoading = false;
        }
      },
      async fetchArticleWithRetry() {
        let retryCount = 0;
        while (retryCount < CONFIG.MAX_RETRIES) {
          try {
            const data = await WikiService.fetchRandomArticle(this.currentLanguageCode);
            if (!utils.validateWikiData(data)) {
              throw new Error("无效的维基数据结构");
            }
            return this.transformWikiData(data);
          } catch (error) {
            retryCount++;
            if (retryCount === CONFIG.MAX_RETRIES)
              throw error;
            formatAppLog("log", "at pages/index/index.vue:212", `正在进行第 ${retryCount} 次重试...`);
            await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY));
          }
        }
      },
      transformWikiData(data) {
        const imageUrl = utils.getBestImageUrl(data);
        const processedImageUrl = utils.processImageUrl(imageUrl);
        return {
          title: data.title,
          excerpt: data.extract,
          image: processedImageUrl || "/static/default-bg.jpg",
          // 确保始终有图片
          url: data.content_urls.desktop.page
        };
      },
      handleLoadError(error) {
        formatAppLog("error", "at pages/index/index.vue:231", "加载文章失败:", error);
        uni.showToast({
          title: error.message || "加载失败，请检查网络",
          icon: "none",
          duration: 2e3
        });
      },
      // 历史记录相关方法
      saveToHistory(item) {
        if (!item)
          return;
        try {
          let history = uni.getStorageSync("wikiHistory") || [];
          if (!history.some((h) => h.url === item.url)) {
            const itemWithTimestamp = {
              ...item,
              timestamp: Date.now()
            };
            history = [...history, itemWithTimestamp].slice(0, CONFIG.MAX_HISTORY_ITEMS);
            uni.setStorageSync("wikiHistory", history);
          }
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:255", "保存历史记录失败:", e);
        }
      },
      // 事件处理方法
      onLanguageChange(e) {
        this.currentLanguageIndex = e.detail.value;
        this.wikiItems = [];
        this.currentIndex = 0;
        this.loadInitialData();
      },
      async onSwiperChange(e) {
        const newIndex = e.detail.current;
        if (newIndex === this.currentIndex)
          return;
        this.saveToHistory(this.wikiItems[newIndex]);
        this.currentIndex = newIndex;
        await this.checkAndLoadMore();
      },
      onAnimationFinish() {
        if (!this.isLoadingMore && this.currentIndex >= this.wikiItems.length - CONFIG.PRELOAD_THRESHOLD) {
          this.checkAndLoadMore();
        }
      },
      async checkAndLoadMore() {
        if (this.isLoadingMore)
          return;
        const remainingItems = this.wikiItems.length - (this.currentIndex + 1);
        if (remainingItems < CONFIG.PRELOAD_THRESHOLD) {
          this.isLoadingMore = true;
          try {
            const article = await this.fetchArticleWithRetry();
            if (article) {
              this.wikiItems.push(article);
              if (this.wikiItems.length > CONFIG.MAX_DISPLAY_ITEMS) {
                this.wikiItems = this.wikiItems.slice(-CONFIG.MAX_DISPLAY_ITEMS);
                this.currentIndex = Math.max(0, this.currentIndex - 1);
              }
            }
          } catch (error) {
            this.handleLoadError(error);
          } finally {
            this.isLoadingMore = false;
          }
        }
      },
      openWikiPage(url) {
        uni.navigateTo({
          url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
        });
      },
      openHistory() {
        uni.navigateTo({
          url: "/pages/profile/profile"
        });
      },
      handleImageError(item) {
        if (item) {
          item.image = "/static/default-bg.jpg";
        }
      }
    },
    watch: {
      wikiItems: {
        handler(newVal, oldVal) {
          if (oldVal.length === 0 && newVal.length > 0) {
            this.$nextTick(() => {
              this.currentIndex = 0;
            });
          }
        },
        deep: true
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $data.wikiItems.length > 0 ? (vue.openBlock(), vue.createElementBlock("swiper", {
        key: 0,
        class: "swiper",
        vertical: "",
        onChange: _cache[3] || (_cache[3] = (...args) => $options.onSwiperChange && $options.onSwiperChange(...args)),
        onAnimationfinish: _cache[4] || (_cache[4] = (...args) => $options.onAnimationFinish && $options.onAnimationFinish(...args)),
        current: $data.currentIndex,
        "disable-touch": $data.isLoading || $data.isLoadingMore,
        duration: 200,
        circular: true,
        "skip-hidden-item-layout": true
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.wikiItems, (item, index) => {
            return vue.openBlock(), vue.createElementBlock("swiper-item", {
              key: item.url
            }, [
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["wiki-item", { "wiki-item-active": index === $data.currentIndex }])
                },
                [
                  vue.createElementVNode("image", {
                    class: "background-image",
                    src: item.image,
                    mode: "aspectFill",
                    onError: ($event) => $options.handleImageError(item),
                    "lazy-load": true
                  }, null, 40, ["src", "onError"]),
                  vue.createElementVNode("view", { class: "content-overlay" }, [
                    vue.createElementVNode(
                      "view",
                      {
                        class: "top-bar",
                        style: vue.normalizeStyle({ top: $data.statusBarHeight + "px" })
                      },
                      [
                        vue.createElementVNode("view", { class: "language-selector" }, [
                          vue.createElementVNode("picker", {
                            onChange: _cache[0] || (_cache[0] = (...args) => $options.onLanguageChange && $options.onLanguageChange(...args)),
                            value: $data.currentLanguageIndex,
                            range: $data.languages.names,
                            onClick: _cache[1] || (_cache[1] = vue.withModifiers(() => {
                            }, ["stop"])),
                            disabled: $data.isLoading || $data.isLoadingMore
                          }, [
                            vue.createElementVNode(
                              "text",
                              { class: "language-text" },
                              vue.toDisplayString($data.languages.names[$data.currentLanguageIndex]),
                              1
                              /* TEXT */
                            )
                          ], 40, ["value", "range", "disabled"])
                        ]),
                        vue.createElementVNode("view", {
                          class: "history-btn",
                          onClick: _cache[2] || (_cache[2] = (...args) => $options.openHistory && $options.openHistory(...args))
                        }, [
                          vue.createElementVNode("text", { class: "history-text" }, "历史")
                        ])
                      ],
                      4
                      /* STYLE */
                    ),
                    vue.createElementVNode("view", {
                      class: "wiki-content",
                      onClick: vue.withModifiers(($event) => $options.openWikiPage(item.url), ["stop"])
                    }, [
                      vue.createElementVNode(
                        "text",
                        { class: "wiki-title" },
                        vue.toDisplayString(item.title),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "wiki-excerpt" },
                        vue.toDisplayString(item.excerpt),
                        1
                        /* TEXT */
                      ),
                      $data.isLoadingMore && index === $data.wikiItems.length - 1 ? (vue.openBlock(), vue.createElementBlock("view", {
                        key: 0,
                        class: "loading-overlay"
                      }, [
                        vue.createElementVNode("text", { class: "loading-text" }, "正在加载更多...")
                      ])) : vue.createCommentVNode("v-if", true)
                    ], 8, ["onClick"])
                  ])
                ],
                2
                /* CLASS */
              )
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ], 40, ["current", "disable-touch"])) : vue.createCommentVNode("v-if", true),
      $data.isLoading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "loading-indicator"
      }, [
        vue.createElementVNode("text", { class: "loading-text" }, "加载中...")
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__file", "/Users/lizhaowei/Desktop/code/wikitok2.0/pages/index/index.vue"]]);
  const _sfc_main$2 = {
    data() {
      return {
        url: ""
      };
    },
    onLoad(options) {
      if (options.url) {
        this.url = decodeURIComponent(options.url);
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "webview-container" }, [
      vue.createElementVNode("web-view", { src: $data.url }, null, 8, ["src"])
    ]);
  }
  const PagesWebviewWebview = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__file", "/Users/lizhaowei/Desktop/code/wikitok2.0/pages/webview/webview.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        historyList: [],
        statusBarHeight: 0,
        isRefreshing: false,
        activeIndex: -1
      };
    },
    onLoad() {
      this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight;
    },
    onShow() {
      this.loadHistory();
    },
    methods: {
      loadHistory() {
        try {
          const history = uni.getStorageSync("wikiHistory") || [];
          this.historyList = history.reverse().map((item) => ({
            ...item,
            timestamp: item.timestamp || Date.now()
          }));
        } catch (e) {
          formatAppLog("error", "at pages/profile/profile.vue:89", "加载历史记录失败:", e);
          uni.showToast({
            title: "加载历史记录失败",
            icon: "none"
          });
        }
      },
      clearHistory() {
        uni.showModal({
          title: "清空历史记录",
          content: "确定要清空所有历史记录吗？",
          confirmColor: "#ff5a5f",
          success: (res) => {
            if (res.confirm) {
              try {
                uni.removeStorageSync("wikiHistory");
                this.historyList = [];
                uni.showToast({
                  title: "已清空",
                  icon: "success"
                });
              } catch (e) {
                formatAppLog("error", "at pages/profile/profile.vue:111", "清空历史记录失败:", e);
                uni.showToast({
                  title: "操作失败",
                  icon: "none"
                });
              }
            }
          }
        });
      },
      openWikiPage(url, index) {
        this.activeIndex = index;
        setTimeout(() => {
          uni.navigateTo({
            url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
          });
        }, 150);
      },
      formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = /* @__PURE__ */ new Date();
        const diff = now - date;
        if (diff < 36e5) {
          const minutes = Math.floor(diff / 6e4);
          return `${minutes}分钟前`;
        }
        if (diff < 864e5) {
          const hours = Math.floor(diff / 36e5);
          return `${hours}小时前`;
        }
        if (diff < 6048e5) {
          const days = Math.floor(diff / 864e5);
          return `${days}天前`;
        }
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      },
      onPulling() {
      },
      async onRefresh() {
        this.isRefreshing = true;
        await this.loadHistory();
        setTimeout(() => {
          this.isRefreshing = false;
        }, 1e3);
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", { class: "header-content" }, [
          vue.createElementVNode("text", { class: "title" }, "历史记录"),
          vue.createElementVNode("view", {
            class: "clear-btn-wrapper",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.clearHistory && $options.clearHistory(...args))
          }, [
            vue.createElementVNode("text", { class: "clear-icon" }, "🗑"),
            vue.createElementVNode("text", { class: "clear-text" }, "清空")
          ])
        ])
      ]),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "history-list",
        "refresher-enabled": true,
        "refresher-triggered": $data.isRefreshing,
        onRefresherpulling: _cache[1] || (_cache[1] = (...args) => $options.onPulling && $options.onPulling(...args)),
        onRefresherrefresh: _cache[2] || (_cache[2] = (...args) => $options.onRefresh && $options.onRefresh(...args))
      }, [
        $data.historyList.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📜"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无浏览记录"),
          vue.createElementVNode("text", { class: "empty-tip" }, "浏览的文章会显示在这里")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "history-content"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.historyList, (item, index) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: index,
                class: vue.normalizeClass(["history-item", { "history-item-active": $data.activeIndex === index }]),
                onClick: ($event) => $options.openWikiPage(item.url, index)
              }, [
                vue.createElementVNode("view", { class: "item-main" }, [
                  vue.createElementVNode("image", {
                    class: "item-image",
                    src: item.image,
                    mode: "aspectFill"
                  }, [
                    !item.image ? (vue.openBlock(), vue.createElementBlock("view", {
                      key: 0,
                      class: "image-placeholder"
                    }, [
                      vue.createElementVNode("text", { class: "placeholder-text" }, "Wiki")
                    ])) : vue.createCommentVNode("v-if", true)
                  ], 8, ["src"]),
                  vue.createElementVNode("view", { class: "item-content" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "item-title" },
                      vue.toDisplayString(item.title),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "item-excerpt" },
                      vue.toDisplayString(item.excerpt),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                vue.createElementVNode("view", { class: "item-footer" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "item-time" },
                    vue.toDisplayString(new Date(item.timestamp).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false
                    })),
                    1
                    /* TEXT */
                  )
                ])
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesProfileProfile = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__file", "/Users/lizhaowei/Desktop/code/wikitok2.0/pages/profile/profile.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/webview/webview", PagesWebviewWebview);
  __definePage("pages/profile/profile", PagesProfileProfile);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "/Users/lizhaowei/Desktop/code/wikitok2.0/App.vue"]]);
  var define_process_env_UNI_STATISTICS_CONFIG_default = { enable: true, version: "1" };
  var define_process_env_UNI_STAT_TITLE_JSON_default = { "pages/webview/webview": "维基百科", "pages/profile/profile": "历史记录" };
  const sys = uni.getSystemInfoSync();
  const STAT_VERSION = "4.45";
  const STAT_URL = "https://tongji.dcloud.io/uni/stat";
  const STAT_H5_URL = "https://tongji.dcloud.io/uni/stat.gif";
  const PAGE_PVER_TIME = 1800;
  const APP_PVER_TIME = 300;
  const OPERATING_TIME = 10;
  const DIFF_TIME = 60 * 1e3 * 60 * 24;
  const appid = "__UNI__CD46827";
  const dbSet = (name, value) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (!data) {
      data = {};
    }
    data[name] = value;
    uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
  };
  const dbGet = (name) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (!data[name]) {
      let dbdata = uni.getStorageSync("$$STAT__DBDATA:" + appid);
      if (!dbdata) {
        dbdata = {};
      }
      if (!dbdata[name]) {
        return void 0;
      }
      data[name] = dbdata[name];
    }
    return data[name];
  };
  const dbRemove = (name) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (data[name]) {
      delete data[name];
      uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
    } else {
      data = uni.getStorageSync("$$STAT__DBDATA:" + appid);
      if (data[name]) {
        delete data[name];
        uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
      }
    }
  };
  const uniStatisticsConfig = define_process_env_UNI_STATISTICS_CONFIG_default;
  let statConfig = {
    appid: "__UNI__CD46827"
  };
  let titleJsons = {};
  titleJsons = define_process_env_UNI_STAT_TITLE_JSON_default;
  const UUID_KEY = "__DC_STAT_UUID";
  const UUID_VALUE = "__DC_UUID_VALUE";
  function getUuid() {
    let uuid = "";
    if (get_platform_name() === "n") {
      try {
        uuid = plus.runtime.getDCloudId();
      } catch (e) {
        uuid = "";
      }
      return uuid;
    }
    try {
      uuid = uni.getStorageSync(UUID_KEY);
    } catch (e) {
      uuid = UUID_VALUE;
    }
    if (!uuid) {
      uuid = Date.now() + "" + Math.floor(Math.random() * 1e7);
      try {
        uni.setStorageSync(UUID_KEY, uuid);
      } catch (e) {
        uni.setStorageSync(UUID_KEY, UUID_VALUE);
      }
    }
    return uuid;
  }
  const get_uuid = (statData2) => {
    return sys.deviceId || getUuid();
  };
  const get_odid = (statData2) => {
    let odid = "";
    if (get_platform_name() === "n") {
      try {
        odid = plus.device.uuid;
      } catch (e) {
        odid = "";
      }
      return odid;
    }
    return sys.deviceId || getUuid();
  };
  const stat_config = statConfig;
  const get_sgin = (statData2) => {
    let arr = Object.keys(statData2);
    let sortArr = arr.sort();
    let sgin = {};
    let sginStr = "";
    for (var i in sortArr) {
      sgin[sortArr[i]] = statData2[sortArr[i]];
      sginStr += sortArr[i] + "=" + statData2[sortArr[i]] + "&";
    }
    return {
      sign: "",
      options: sginStr.substr(0, sginStr.length - 1)
    };
  };
  const get_encodeURIComponent_options = (statData2) => {
    let data = {};
    for (let prop in statData2) {
      data[prop] = encodeURIComponent(statData2[prop]);
    }
    return data;
  };
  const get_platform_name = () => {
    const aliArr = ["y", "a", "p", "mp-ali"];
    const platformList = {
      app: "n",
      "app-plus": "n",
      "app-harmony": "n",
      "mp-harmony": "mhm",
      h5: "h5",
      "mp-weixin": "wx",
      [aliArr.reverse().join("")]: "ali",
      "mp-baidu": "bd",
      "mp-toutiao": "tt",
      "mp-qq": "qq",
      "quickapp-native": "qn",
      "mp-kuaishou": "ks",
      "mp-lark": "lark",
      "quickapp-webview": "qw",
      "mp-xhs": "xhs"
    };
    if (platformList["app"] === "ali") {
      if (my && my.env) {
        const clientName = my.env.clientName;
        if (clientName === "ap")
          return "ali";
        if (clientName === "dingtalk")
          return "dt";
      }
    }
    return platformList["app"] || "app";
  };
  const get_pack_name = () => {
    let packName = "";
    if (get_platform_name() === "wx" || get_platform_name() === "qq") {
      if (uni.canIUse("getAccountInfoSync")) {
        packName = uni.getAccountInfoSync().miniProgram.appId || "";
      }
    }
    if (get_platform_name() === "n")
      ;
    return packName;
  };
  const get_version = () => {
    return get_platform_name() === "n" ? plus.runtime.version : "";
  };
  const get_channel = () => {
    const platformName = get_platform_name();
    let channel = "";
    if (platformName === "n") {
      channel = plus.runtime.channel;
    }
    return channel;
  };
  const get_scene = (options) => {
    const platformName = get_platform_name();
    let scene = "";
    if (options) {
      return options;
    }
    if (platformName === "wx") {
      scene = uni.getLaunchOptionsSync().scene;
    }
    return scene;
  };
  const get_splicing = (data) => {
    let str = "";
    for (var i in data) {
      str += i + "=" + data[i] + "&";
    }
    return str.substr(0, str.length - 1);
  };
  const get_route = (pageVm) => {
    let _self = pageVm || get_page_vm();
    if (get_platform_name() === "bd") {
      let mp_route = _self.$mp && _self.$mp.page && _self.$mp.page.is;
      let scope_route = _self.$scope && _self.$scope.is;
      return mp_route || scope_route || "";
    } else {
      return _self.route || _self.$scope && _self.$scope.route || _self.$mp && _self.$mp.page.route;
    }
  };
  const get_page_route = (pageVm) => {
    let page = pageVm && (pageVm.$page || pageVm.$scope && pageVm.$scope.$page);
    let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
    if (!page)
      return lastPageRoute || "";
    return page.fullPath === "/" ? page.route : page.fullPath || page.route;
  };
  const get_page_vm = () => {
    let pages = getCurrentPages();
    let $page = pages[pages.length - 1];
    if (!$page)
      return null;
    return $page.$vm;
  };
  const get_page_types = (self) => {
    if (self.mpType === "page" || self.$mpType === "page" || self.$mp && self.$mp.mpType === "page" || self.$options.mpType === "page") {
      return "page";
    }
    if (self.mpType === "app" || self.$mpType === "app" || self.$mp && self.$mp.mpType === "app" || self.$options.mpType === "app") {
      return "app";
    }
    return null;
  };
  const handle_data = (statData2) => {
    let firstArr = [];
    let contentArr = [];
    let lastArr = [];
    for (let i in statData2) {
      const rd = statData2[i];
      rd.forEach((elm) => {
        let newData = "";
        {
          newData = get_splicing(elm);
        }
        if (i === 0) {
          firstArr.push(newData);
        } else if (i === 3) {
          lastArr.push(newData);
        } else {
          contentArr.push(newData);
        }
      });
    }
    firstArr.push(...contentArr, ...lastArr);
    return JSON.stringify(firstArr);
  };
  const calibration = (eventName, options) => {
    if (!eventName) {
      console.error(`uni.report Missing [eventName] parameter`);
      return true;
    }
    if (typeof eventName !== "string") {
      console.error(
        `uni.report [eventName] Parameter type error, it can only be of type String`
      );
      return true;
    }
    if (eventName.length > 255) {
      console.error(
        `uni.report [eventName] Parameter length cannot be greater than 255`
      );
      return true;
    }
    if (typeof options !== "string" && typeof options !== "object") {
      console.error(
        "uni.report [options] Parameter type error, Only supports String or Object type"
      );
      return true;
    }
    if (typeof options === "string" && options.length > 255) {
      console.error(
        `uni.report [options] Parameter length cannot be greater than 255`
      );
      return true;
    }
    if (eventName === "title" && typeof options !== "string") {
      console.error(
        `uni.report [eventName] When the parameter is title, the [options] parameter can only be of type String`
      );
      return true;
    }
  };
  const get_page_name = (routepath) => {
    return titleJsons && titleJsons[routepath] || "";
  };
  const Report_Data_Time = "Report_Data_Time";
  const Report_Status = "Report_Status";
  const is_report_data = () => {
    return new Promise((resolve, reject) => {
      let start_time = "";
      let end_time = (/* @__PURE__ */ new Date()).getTime();
      let diff_time = DIFF_TIME;
      let report_status = 1;
      try {
        start_time = uni.getStorageSync(Report_Data_Time);
        report_status = uni.getStorageSync(Report_Status);
      } catch (e) {
        start_time = "";
        report_status = 1;
      }
      if (report_status === "") {
        requestData(({ enable }) => {
          uni.setStorageSync(Report_Data_Time, end_time);
          uni.setStorageSync(Report_Status, enable);
          if (enable === 1) {
            resolve();
          }
        });
        return;
      }
      if (report_status === 1) {
        resolve();
      }
      if (!start_time) {
        uni.setStorageSync(Report_Data_Time, end_time);
        start_time = end_time;
      }
      if (end_time - start_time > diff_time) {
        requestData(({ enable }) => {
          uni.setStorageSync(Report_Data_Time, end_time);
          uni.setStorageSync(Report_Status, enable);
        });
      }
    });
  };
  const requestData = (done) => {
    const appid2 = "__UNI__CD46827";
    let formData = {
      usv: STAT_VERSION,
      conf: JSON.stringify({
        ak: appid2
      })
    };
    uni.request({
      url: STAT_URL,
      method: "GET",
      data: formData,
      success: (res) => {
        const { data } = res;
        if (data.ret === 0) {
          typeof done === "function" && done({
            enable: data.enable
          });
        }
      },
      fail: (e) => {
        let report_status_code = 1;
        try {
          report_status_code = uni.getStorageSync(Report_Status);
        } catch (e2) {
          report_status_code = 1;
        }
        if (report_status_code === "") {
          report_status_code = 1;
        }
        typeof done === "function" && done({
          enable: report_status_code
        });
      }
    });
  };
  const get_report_Interval = (defaultTime) => {
    let time = uniStatisticsConfig.reportInterval;
    if (Number(time) === 0)
      return 0;
    time = time || defaultTime;
    let reg = /(^[1-9]\d*$)/;
    if (!reg.test(time))
      return defaultTime;
    return Number(time);
  };
  const is_push_clientid = () => {
    if (uniStatisticsConfig.collectItems) {
      const ClientID = uniStatisticsConfig.collectItems.uniPushClientID;
      return typeof ClientID === "boolean" ? ClientID : false;
    }
    return false;
  };
  const is_page_report = () => {
    if (uniStatisticsConfig.collectItems) {
      const statPageLog = uniStatisticsConfig.collectItems.uniStatPageLog;
      if (statPageLog === void 0)
        return true;
      return typeof statPageLog === "boolean" ? statPageLog : true;
    }
    return true;
  };
  const FIRST_VISIT_TIME_KEY = "__first__visit__time";
  const LAST_VISIT_TIME_KEY = "__last__visit__time";
  const get_time = () => {
    return parseInt((/* @__PURE__ */ new Date()).getTime() / 1e3);
  };
  const get_first_visit_time = () => {
    const timeStorge = dbGet(FIRST_VISIT_TIME_KEY);
    let time = 0;
    if (timeStorge) {
      time = timeStorge;
    } else {
      time = get_time();
      dbSet(FIRST_VISIT_TIME_KEY, time);
      dbRemove(LAST_VISIT_TIME_KEY);
    }
    return time;
  };
  const get_last_visit_time = () => {
    const timeStorge = dbGet(LAST_VISIT_TIME_KEY);
    let time = 0;
    if (timeStorge) {
      time = timeStorge;
    }
    dbSet(LAST_VISIT_TIME_KEY, get_time());
    return time;
  };
  const PAGE_RESIDENCE_TIME = "__page__residence__time";
  let First_Page_Residence_Time = 0;
  let Last_Page_Residence_Time = 0;
  const set_page_residence_time = () => {
    First_Page_Residence_Time = get_time();
    dbSet(PAGE_RESIDENCE_TIME, First_Page_Residence_Time);
    return First_Page_Residence_Time;
  };
  const get_page_residence_time = () => {
    Last_Page_Residence_Time = get_time();
    First_Page_Residence_Time = dbGet(PAGE_RESIDENCE_TIME);
    return Last_Page_Residence_Time - First_Page_Residence_Time;
  };
  const TOTAL_VISIT_COUNT = "__total__visit__count";
  const get_total_visit_count = () => {
    const timeStorge = dbGet(TOTAL_VISIT_COUNT);
    let count = 1;
    if (timeStorge) {
      count = timeStorge;
      count++;
    }
    dbSet(TOTAL_VISIT_COUNT, count);
    return count;
  };
  const FIRST_TIME = "__first_time";
  const set_first_time = () => {
    let time = get_time();
    const timeStorge = dbSet(FIRST_TIME, time);
    return timeStorge;
  };
  const get_residence_time = (type) => {
    let residenceTime = 0;
    const first_time = dbGet(FIRST_TIME);
    const last_time = get_time();
    if (first_time !== 0) {
      residenceTime = last_time - first_time;
    }
    residenceTime = residenceTime < 1 ? 1 : residenceTime;
    if (type === "app") {
      let overtime = residenceTime > APP_PVER_TIME ? true : false;
      return {
        residenceTime,
        overtime
      };
    }
    if (type === "page") {
      let overtime = residenceTime > PAGE_PVER_TIME ? true : false;
      return {
        residenceTime,
        overtime
      };
    }
    return {
      residenceTime
    };
  };
  const eport_Interval = get_report_Interval(OPERATING_TIME);
  let statData = {
    uuid: get_uuid(),
    // 设备标识
    ak: stat_config.appid,
    // uni-app 应用 Appid
    p: "",
    // 手机系统，客户端平台
    ut: get_platform_name(),
    // 平台类型
    mpn: get_pack_name(),
    // 原生平台包名、小程序 appid
    usv: STAT_VERSION,
    // 统计 sdk 版本
    v: get_version(),
    // 应用版本，仅app
    ch: get_channel(),
    // 渠道信息
    cn: "",
    // 国家
    pn: "",
    // 省份
    ct: "",
    // 城市
    t: get_time(),
    // 上报数据时的时间戳
    tt: "",
    brand: sys.brand || "",
    // 手机品牌
    md: sys.model,
    // 手机型号
    sv: "",
    // 手机系统版本
    mpsdk: sys.SDKVersion || "",
    // x程序 sdk version
    mpv: sys.version || "",
    // 小程序平台版本 ，如微信、支付宝
    lang: sys.language,
    // 语言
    pr: sys.pixelRatio,
    // pixelRatio 设备像素比
    ww: sys.windowWidth,
    // windowWidth 可使用窗口宽度
    wh: sys.windowHeight,
    // windowHeight 可使用窗口高度
    sw: sys.screenWidth,
    // screenWidth 屏幕宽度
    sh: sys.screenHeight
    // screenHeight 屏幕高度
  };
  if (sys.platform) {
    switch (sys.platform) {
      case "android":
        statData.p = "a";
        break;
      case "ios":
        statData.p = "i";
        break;
      case "harmonyos":
        statData.p = "h";
        break;
    }
  }
  if (sys.system) {
    statData.sv = sys.system.replace(/(Android|iOS)\s/, "");
  }
  class Report {
    constructor() {
      this.self = "";
      this.__licationShow = false;
      this.__licationHide = false;
      this.statData = statData;
      this._navigationBarTitle = {
        config: "",
        page: "",
        report: "",
        lt: ""
      };
      this._query = {};
      let registerInterceptor = typeof uni.addInterceptor === "function";
      if (registerInterceptor) {
        this.addInterceptorInit();
        this.interceptLogin();
        this.interceptShare(true);
        this.interceptRequestPayment();
      }
    }
    addInterceptorInit() {
      let self = this;
      uni.addInterceptor("setNavigationBarTitle", {
        invoke(args) {
          self._navigationBarTitle.page = args.title;
        }
      });
    }
    interceptLogin() {
      let self = this;
      uni.addInterceptor("login", {
        complete() {
          self._login();
        }
      });
    }
    interceptShare(type) {
      let self = this;
      if (!type) {
        self._share();
        return;
      }
      uni.addInterceptor("share", {
        success() {
          self._share();
        },
        fail() {
          self._share();
        }
      });
    }
    interceptRequestPayment() {
      let self = this;
      uni.addInterceptor("requestPayment", {
        success() {
          self._payment("pay_success");
        },
        fail() {
          self._payment("pay_fail");
        }
      });
    }
    _login() {
      this.sendEventRequest(
        {
          key: "login"
        },
        0
      );
    }
    _share() {
      this.sendEventRequest(
        {
          key: "share"
        },
        0
      );
    }
    _payment(key) {
      this.sendEventRequest(
        {
          key
        },
        0
      );
    }
    /**
     * 进入应用触发
     */
    applicationShow() {
      if (this.__licationHide) {
        const time = get_residence_time("app");
        if (time.overtime) {
          let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
          let options = {
            path: lastPageRoute,
            scene: this.statData.sc,
            cst: 2
          };
          this.sendReportRequest(options);
        } else {
          const scene = get_scene();
          if (scene !== this.statData.sc) {
            let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
            let options = {
              path: lastPageRoute,
              scene,
              cst: 2
            };
            this.sendReportRequest(options);
          }
        }
        this.__licationHide = false;
      }
    }
    /**
     * 离开应用触发
     * @param {Object} self
     * @param {Object} type
     */
    applicationHide(self, type) {
      if (!self) {
        self = get_page_vm();
      }
      this.__licationHide = true;
      const time = get_residence_time();
      const route = get_page_route(self);
      uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
      this.sendHideRequest(
        {
          urlref: route,
          urlref_ts: time.residenceTime
        },
        type
      );
      set_first_time();
    }
    /**
     * 进入页面触发
     */
    pageShow(self) {
      this._navigationBarTitle = {
        config: "",
        page: "",
        report: "",
        lt: ""
      };
      const route = get_page_route(self);
      const routepath = get_route(self);
      this._navigationBarTitle.config = get_page_name(routepath);
      if (this.__licationShow) {
        set_first_time();
        uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
        this.__licationShow = false;
        return;
      }
      const time = get_residence_time("page");
      if (time.overtime) {
        let options = {
          path: route,
          scene: this.statData.sc,
          cst: 3
        };
        this.sendReportRequest(options);
      }
      set_first_time();
    }
    /**
     * 离开页面触发
     */
    pageHide(self) {
      if (!this.__licationHide) {
        const time = get_residence_time("page");
        let route = get_page_route(self);
        let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
        if (!lastPageRoute) {
          lastPageRoute = route;
        }
        uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
        this.sendPageRequest({
          url: route,
          urlref: lastPageRoute,
          urlref_ts: time.residenceTime
        });
        return;
      }
    }
    /**
     * 发送请求,应用维度上报
     * @param {Object} options 页面信息
     * @param {Boolean} type 是否立即上报
     */
    sendReportRequest(options, type) {
      this._navigationBarTitle.lt = "1";
      this._navigationBarTitle.config = get_page_name(options.path);
      let is_opt = options.query && JSON.stringify(options.query) !== "{}";
      let query = is_opt ? "?" + JSON.stringify(options.query) : "";
      const last_time = get_last_visit_time();
      if (last_time !== 0 || !last_time) {
        const odid = get_odid();
        {
          this.statData.odid = odid;
        }
      }
      Object.assign(this.statData, {
        lt: "1",
        url: options.path + query || "",
        t: get_time(),
        sc: get_scene(options.scene),
        fvts: get_first_visit_time(),
        lvts: last_time,
        tvc: get_total_visit_count(),
        // create session type  上报类型 ，1 应用进入 2.后台30min进入 3.页面30min进入
        cst: options.cst || 1
      });
      if (get_platform_name() === "n") {
        this.getProperty(type);
      } else {
        this.getNetworkInfo(type);
      }
    }
    /**
     * 发送请求,页面维度上报
     * @param {Object} opt
     */
    sendPageRequest(opt) {
      let { url, urlref, urlref_ts } = opt;
      this._navigationBarTitle.lt = "11";
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "11",
        ut: this.statData.ut,
        url,
        tt: this.statData.tt,
        urlref,
        urlref_ts,
        ch: this.statData.ch,
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options);
    }
    /**
     * 进入后台上报数据
     * @param {Object} opt
     * @param {Object} type
     */
    sendHideRequest(opt, type) {
      let { urlref, urlref_ts } = opt;
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "3",
        ut: this.statData.ut,
        urlref,
        urlref_ts,
        ch: this.statData.ch,
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options, type);
    }
    /**
     * 自定义事件上报
     */
    sendEventRequest({ key = "", value = "" } = {}) {
      let routepath = "";
      try {
        routepath = get_route();
      } catch (error) {
        const launch_options = dbGet("__launch_options");
        routepath = launch_options.path;
      }
      this._navigationBarTitle.config = get_page_name(routepath);
      this._navigationBarTitle.lt = "21";
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "21",
        ut: this.statData.ut,
        url: routepath,
        ch: this.statData.ch,
        e_n: key,
        e_v: typeof value === "object" ? JSON.stringify(value) : value.toString(),
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options);
    }
    sendPushRequest(options, cid) {
      let time = get_time();
      const statData2 = {
        lt: "101",
        cid,
        t: time,
        ut: this.statData.ut
      };
      const stat_data = handle_data({
        101: [statData2]
      });
      let optionsData = {
        usv: STAT_VERSION,
        //统计 SDK 版本号
        t: time,
        //发送请求时的时间戮
        requests: stat_data
      };
      {
        if (statData2.ut === "h5") {
          this.imageRequest(optionsData);
          return;
        }
      }
      if (get_platform_name() === "n" && this.statData.p === "a") {
        setTimeout(() => {
          this.sendRequest(optionsData);
        }, 200);
        return;
      }
      this.sendRequest(optionsData);
    }
    /**
     * 获取wgt资源版本
     */
    getProperty(type) {
      plus.runtime.getProperty(plus.runtime.appid, (wgtinfo) => {
        this.statData.v = wgtinfo.version || "";
        this.getNetworkInfo(type);
      });
    }
    /**
     * 获取网络信息
     */
    getNetworkInfo(type) {
      uni.getNetworkType({
        success: (result) => {
          this.statData.net = result.networkType;
          this.getLocation(type);
        }
      });
    }
    /**
     * 获取位置信息
     */
    getLocation(type) {
      if (stat_config.getLocation) {
        uni.getLocation({
          type: "wgs84",
          geocode: true,
          success: (result) => {
            if (result.address) {
              this.statData.cn = result.address.country;
              this.statData.pn = result.address.province;
              this.statData.ct = result.address.city;
            }
            this.statData.lat = result.latitude;
            this.statData.lng = result.longitude;
            this.request(this.statData, type);
          }
        });
      } else {
        this.statData.lat = 0;
        this.statData.lng = 0;
        this.request(this.statData, type);
      }
    }
    /**
     * 发送请求
     * @param {Object} data 上报数据
     * @param {Object} type 类型
     */
    request(data, type) {
      let time = get_time();
      const title = this._navigationBarTitle;
      Object.assign(data, {
        ttn: title.page,
        ttpj: title.config,
        ttc: title.report
      });
      let uniStatData = dbGet("__UNI__STAT__DATA") || {};
      if (!uniStatData[data.lt]) {
        uniStatData[data.lt] = [];
      }
      uniStatData[data.lt].push(data);
      dbSet("__UNI__STAT__DATA", uniStatData);
      let page_residence_time = get_page_residence_time();
      if (page_residence_time < eport_Interval && !type)
        return;
      set_page_residence_time();
      const stat_data = handle_data(uniStatData);
      let optionsData = {
        usv: STAT_VERSION,
        //统计 SDK 版本号
        t: time,
        //发送请求时的时间戮
        requests: stat_data
      };
      dbRemove("__UNI__STAT__DATA");
      {
        if (data.ut === "h5") {
          this.imageRequest(optionsData);
          return;
        }
      }
      if (get_platform_name() === "n" && this.statData.p === "a") {
        setTimeout(() => {
          this.sendRequest(optionsData);
        }, 200);
        return;
      }
      this.sendRequest(optionsData);
    }
    getIsReportData() {
      return is_report_data();
    }
    /**
     * 数据上报
     * @param {Object} optionsData 需要上报的数据
     */
    sendRequest(optionsData) {
      {
        this.getIsReportData().then(() => {
          uni.request({
            url: STAT_URL,
            method: "POST",
            data: optionsData,
            success: () => {
            },
            fail: (e) => {
              if (++this._retry < 3) {
                setTimeout(() => {
                  this.sendRequest(optionsData);
                }, 1e3);
              }
            }
          });
        });
      }
    }
    /**
     * h5 请求
     */
    imageRequest(data) {
      this.getIsReportData().then(() => {
        let image = new Image();
        let options = get_sgin(get_encodeURIComponent_options(data)).options;
        image.src = STAT_H5_URL + "?" + options;
      });
    }
    sendEvent(key, value) {
      if (calibration(key, value))
        return;
      if (key === "title") {
        this._navigationBarTitle.report = value;
        return;
      }
      this.sendEventRequest(
        {
          key,
          value: typeof value === "object" ? JSON.stringify(value) : value
        },
        1
      );
    }
  }
  class Stat extends Report {
    static getInstance() {
      if (!uni.__stat_instance) {
        uni.__stat_instance = new Stat();
      }
      return uni.__stat_instance;
    }
    constructor() {
      super();
    }
    /**
     * 获取推送id
     */
    pushEvent(options) {
      const ClientID = is_push_clientid();
      if (uni.getPushClientId && ClientID) {
        uni.getPushClientId({
          success: (res) => {
            const cid = res.cid || false;
            if (cid) {
              this.sendPushRequest(options, cid);
            }
          }
        });
      }
    }
    /**
     * 进入应用
     * @param {Object} options 页面参数
     * @param {Object} self	当前页面实例
     */
    launch(options, self) {
      set_page_residence_time();
      this.__licationShow = true;
      dbSet("__launch_options", options);
      options.cst = 1;
      this.sendReportRequest(options, true);
    }
    load(options, self) {
      this.self = self;
      this._query = options;
    }
    appHide(self) {
      this.applicationHide(self, true);
    }
    appShow(self) {
      this.applicationShow(self);
    }
    show(self) {
      this.self = self;
      if (get_page_types(self) === "page") {
        const isPageReport = is_page_report();
        if (isPageReport) {
          this.pageShow(self);
        }
      }
      if (get_platform_name() === "h5" || get_platform_name() === "n") {
        if (get_page_types(self) === "app") {
          this.appShow();
        }
      }
    }
    hide(self) {
      this.self = self;
      if (get_page_types(self) === "page") {
        const isPageReport = is_page_report();
        if (isPageReport) {
          this.pageHide(self);
        }
      }
      if (get_platform_name() === "h5" || get_platform_name() === "n") {
        if (get_page_types(self) === "app") {
          this.appHide();
        }
      }
    }
    error(em) {
      let emVal = "";
      if (!em.message) {
        emVal = JSON.stringify(em);
      } else {
        emVal = em.stack;
      }
      let route = "";
      try {
        route = get_route();
      } catch (e) {
        route = "";
      }
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "31",
        url: route,
        ut: this.statData.ut,
        ch: this.statData.ch,
        mpsdk: this.statData.mpsdk,
        mpv: this.statData.mpv,
        v: this.statData.v,
        em: emVal,
        usv: this.statData.usv,
        t: parseInt((/* @__PURE__ */ new Date()).getTime() / 1e3)
      };
      this.request(options);
    }
  }
  Stat.getInstance();
  function main() {
    {
      {
        uni.report = function(type, options) {
        };
      }
    }
  }
  main();
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
