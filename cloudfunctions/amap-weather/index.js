const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { adcode } = event || {}
  if (!adcode) {
    throw new Error('adcode required')
  }

  const key = process.env.AMAP_KEY
  if (!key) {
    throw new Error('AMAP_KEY not configured in cloud function env')
  }

  const res = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo', {
    params: { key, city: adcode, extensions: 'base' },
    timeout: 8000,
  })

  if (res.data.status !== '1') {
    throw new Error(`amap weather error: ${res.data.info || 'unknown'}`)
  }

  const live = (res.data.lives || [])[0]
  if (!live) return { weather: null }

  const temp = parseInt(live.temperature, 10)
  return {
    weather: {
      city: live.city || '',
      cityAdcode: live.adcode || '',
      temp: Number.isFinite(temp) ? temp : 0,
      low: Number.isFinite(temp) ? temp : 0,  // 实况无 low；后续 forecast 改进
      desc: live.weather || '',
      icon: live.weather || '',                // 客户端按 desc 映射图标
      fetchedAt: Date.now(),
    }
  }
}
