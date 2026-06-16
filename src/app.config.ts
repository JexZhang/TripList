export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
    'pages/me/index',
    'pages/library/index',
    'pages/template/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行册-AI旅行攻略',
    navigationBarTextStyle: 'black'
  },
  permission: {
    'scope.userLocation': {
      desc: '用于在地图上显示你的当前位置',
    },
  },
  requiredPrivateInfos: ['getLocation'],
  lazyCodeLoading: 'requiredComponents'
})
