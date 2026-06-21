const cloud = require('wx-server-sdk')
const axios = require('axios')
const { requireOpenid } = require('./_shared/auth-helper')
const { validateSearchKw } = require('./_shared/input-guard')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  requireOpenid()
  const { keyword, city } = event || {}
  const kwCheck = validateSearchKw(keyword)
  if (!kwCheck.ok) return { results: [] }
  const cleanKw = kwCheck.clean

  const key = process.env.AMAP_KEY
  if (!key) {
    throw new Error('AMAP_KEY not configured in cloud function env')
  }

  const res = await axios.get('https://restapi.amap.com/v5/place/text', {
    params: {
      key,
      keywords: cleanKw,
      region: city || '',
      page_size: 20,
    },
    timeout: 8000,
  })

  if (res.data.status !== '1') {
    throw new Error(`amap error: ${res.data.info || 'unknown'}`)
  }

  const results = (res.data.pois || []).map(p => {
    const [lng, lat] = String(p.location || '0,0').split(',').map(Number)
    return {
      name: p.name || '',
      address: p.address || '',
      city: p.cityname || '',
      district: p.adname || '',
      adcode: p.adcode || '',
      lat: lat || 0,
      lng: lng || 0,
    }
  })

  return { results }
}
