import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifest: ({ mode }) => {
    const workerUrl = import.meta.env.WXT_LOOKUP_API_URL;
    if (mode === 'production' && !workerUrl) {
      throw new Error('배포 빌드에는 WXT_LOOKUP_API_URL이 필요합니다.');
    }
    return {
      name: 'Drag and Find',
      description:
        '모르는 단어를 드래그하고 아이콘 또는 Alt+Shift+F를 누르면 네이버 백과 또는 위키백과 설명을 보여 줍니다.',
      homepage_url: 'https://github.com/choimiae/drag_and_find',
      permissions: ['storage'],
      host_permissions: workerUrl ? [`${new URL(workerUrl).origin}/*`] : [],
      commands: {
        'lookup-selection': {
          suggested_key: { default: 'Alt+Shift+F', mac: 'Alt+Shift+F' },
          description: '선택한 단어 찾기',
        },
      },
    };
  },
});
