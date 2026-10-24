import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifest: {
    name: 'Drag and Find',
    description:
      '모르는 단어를 드래그하고 아이콘 또는 Alt+Shift+F를 누르면 위키백과 요약을 바로 보여 줍니다.',
    homepage_url: 'https://github.com/choimiae/drag_and_find',
    permissions: ['storage'],
    host_permissions: ['https://ko.wikipedia.org/*'],
    commands: {
      'lookup-selection': {
        suggested_key: { default: 'Alt+Shift+F', mac: 'Alt+Shift+F' },
        description: '선택한 단어 찾기',
      },
    },
  },
});
