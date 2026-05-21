export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行册',
    navigationBarTextStyle: 'black'
  },
  lazyCodeLoading: 'requiredComponents'
})
