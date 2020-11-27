import axios from "axios"
import router from "../router"
import qs from "qs"

const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 12000,
  transformRequest: [function (data) {
    if (data !== null && data !== undefined && !(data instanceof FormData)) {
      return qs.stringify({ param: JSON.stringify(data) })
    } else {
      return data
    }
  }]
})

axiosInstance.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'

// 请求拦截器
const requestInterceptor = function (config) {
  // todo
  // 这里可以统一添加token
  config.params = {
    token: new Date() - 0,
    param: config.param,
    t: Date.parse(new Date) + Math.random(10000)
  }
  return config
}
// 请求拦截器错误处理
const requestError = function (error) {
  return Promise.reject(error)
}
// 响应拦截器
const responseInterceptor = function (response) {
  // todo 其实就是对返回的报文做是否正确错误的处理以及转换格式。
  return response
}
// 响应拦截器错误处理
const responseError = function (error) {
  if (!error || !error.response) { // 没有返回值
    // 跳转500
  }
  if (error.response) {
    switch (error.response.status) {
      case 402:
        // // 清除token信息
        // permissionUtil.logout()
        console.log('responseError')

        return Promise.reject(error)
      case 404:
        console.log('404le ')
        // 跳转404
        // redirectPage('/404')
        break
    }
  }
  return Promise.reject(error)
}

// 设置请求拦截器
axiosInstance.interceptors.request.use(requestInterceptor, requestError)
// 设置响应拦截器
axiosInstance.interceptors.response.use(responseInterceptor, responseError)
// 设置路由守卫
// axiosInstance.beforeEach((to, from, next) => {
//   // todo 每次跳转页面的时候都需要检查一下是否有权限

// })

export default axiosInstance
