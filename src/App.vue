<template lang="pug">
#app
  drawing-chat
</template>

<script lang="ts">
import { Watch, Component, Vue } from 'vue-property-decorator';
import DrawingChat from './components/DrawingChat.vue';

@Component({
  components: {
    DrawingChat,
  },
})
export default class App extends Vue {
}
</script>

<style lang="scss">
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.controls {
  display: flex;
  padding: 1rem;
}
.control {
  margin: 0 1rem;
  display: flex;
  align-items: center;
}
.color-sample {
  width: 1rem;
  height: 1rem;
  margin: 0 0.5rem;
  display: inline-block;
}
</style>
