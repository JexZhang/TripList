const cloud = require('wx-server-sdk')
const axios = require('axios')
const { requireOpenid } = require('./_shared/auth-helper')
const { validateAdcode } = require('./_shared/input-guard')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  requireOpenid()
  const { adcode } = event || {}
  const adCheck = validateAdcode(adcode)
  if (!adCheck.ok) throw new Error(adCheck.error)
  const cleanAdcode = adCheck.clean

  const key = process.env.AMAP_KEY
  if (!key) {
    throw new Error('AMAP_KEY not configured in cloud function env')
  }

  const res = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo', {
    params: { key, city: cleanAdcode, extensions: 'all' },
    timeout: 8000,
  })

  if (res.data.status !== '1') {
    throw new Error(`amap weather error: ${res.data.info || 'unknown'}`)
  }

  const forecast = (res.data.forecasts || [])[0]
  const today = forecast && (forecast.casts || [])[0]
  if (!forecast || !today) return { weather: null }

  const high = parseInt(today.daytemp, 10)
  const low = parseInt(today.nighttemp, 10)
  return {
    weather: {
      city: forecast.city || '',
      cityAdcode: forecast.adcode || '',
      high: Number.isFinite(high) ? high : 0,
      low: Number.isFinite(low) ? low : 0,
      desc: today.dayweather || '',
      icon: today.dayweather || '',
      fetchedAt: Date.now(),
    }
  }
}
