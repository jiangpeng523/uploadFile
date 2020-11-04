import Vue from 'vue'
import Router from 'vue-router'
import HelloWorld from '@/components/HelloWorld'
import UploadFile from '@/components/UploadFile'
import JpUploadFile from '../components/jpUploadFile.vue'
Vue.use(Router)

export default new Router({
  routes: [
    // {
    //   path: '/',
    //   name: 'HelloWorld',
    //   component: HelloWorld
    // },
    {
      path: '/',
      name: 'UploadFile',
      component: UploadFile
    },
    {
      path: '/jp',
      name: 'JpUploadFile',
      component: JpUploadFile
    }
  ]
})
