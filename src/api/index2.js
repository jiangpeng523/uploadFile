import axios from 'axios'
import store from '../vuex/store'
import permissionUtil from '../util/permissionUtil'
import router from '../router'
import qs from 'qs'

const axiosInstance = axios.create({ // axios 通用配置项
  baseUrl: '/api',
  timeout: 120000,
  transformRequest: [function (data) {
    if (data !== null && data !== undefined && !(data instanceof FormData)) {
      return qs.stringify({ param: JSON.stringify(data) })
    } else {
      return data
    }
  }]
})

axiosInstance.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'

const requestInterceptor = function (config) {
  if (permissionUtil.getToken()) {
    // token，如果存在的话，都加上token
    config.params = {
      token: permissionUtil.getToken(),
      param: config.params,
      t: Date.parse(new Date()) + Math.random(10000)

    }
  } else if (permissionUtil.getTicket()) {
    // ticket，如果存在的话，都加上ticket
    // console.log(config)
    config.params = {
      ticket: permissionUtil.getTicket(),
      servicePath: permissionUtil.getServicePath(),
      param: config.params
    }
  } else {
    config.params = {
      param: config.params
    }
  }
  return config
}
const requestError = function (error) {
  return Promise.reject(error)
}
const responseInterceptor = function (response) {
  if (!response || !response.data) {
    // 跳转500
    redirectPage('/500')
  }
  switch (response.data.code) {
    case 402:
      // 清除token信息
      permissionUtil.cleanToken()
      // 跳转登录页面
      if (window.location.pathname === '/logining') {
        permissionUtil.toReLogin('/home')
      } else {
        let param = window.location.search
        permissionUtil.toReLogin(window.location.pathname + param)
      }
  }
  // 检查token
  let token = response.data.token

  if (token !== undefined) {
    if (permissionUtil.getToken() != null && permissionUtil.getToken() !== '' && permissionUtil.getToken() === token) {
      return response
    } else {
      permissionUtil.setToken(token)
      permissionUtil.setTicket('')
      store.commit('SET_PERMISSION', [])
    }
  }
  return response
}

const responseError = function (error) {
  if (!error || !error.response) {
    // 跳转500
    // redirectPage('/500')
  }
  // 检查状态
  if (error.response) {
    switch (error.response.status) {
      case 402:
        // // 清除token信息
        // permissionUtil.logout()
        console.log('responseError')

        permissionUtil.cleanToken()

        return error
      case 404:
        console.log('404le ')
        // 跳转404
        // redirectPage('/404')
        break
    }
  }

  return Promise.reject(error)
}

const redirectPage = function (path) {
  router.replace({
    path: path
  })
}

// 添加token信息
// instance.defaults.headers.common['Authorization'] = AUTH_TOKEN

// axiosInstance.defaults.withCredentials=true

// 请求拦截器
axiosInstance.interceptors.request.use(requestInterceptor, requestError)

// 响应拦截器
axiosInstance.interceptors.response.use(responseInterceptor, responseError)

export default axiosInstance




