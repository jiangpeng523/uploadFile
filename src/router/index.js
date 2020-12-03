/*
 * @Author: your name
 * @Date: 2020-12-03 21:56:14
 * @LastEditTime: 2020-12-03 22:09:49
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \uploadFile\src\router\index.js
 */
import Vue from 'vue'
import Router from 'vue-router'
import UploadFile from '@/components/UploadFile'
import JpUploadFile from '../components/jpUploadFile.vue'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/xhr',
      name: 'UploadFile',
      component: UploadFile
    },
    {
      path: '/',
      name: 'JpUploadFile',
      component: JpUploadFile
    }
  ]
})
