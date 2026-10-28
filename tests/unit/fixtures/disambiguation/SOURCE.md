# 출처

이 폴더의 JSON은 한국어 위키백과 API(`ko.wikipedia.org/w/api.php`)에서 받은 응답 사본이다. 받은 날짜는 아래 항목마다 적었다.
글 내용의 저작권은 위키백과 기여자에게 있으며 CC BY-SA 4.0으로 이용한다.
https://creativecommons.org/licenses/by-sa/4.0/deed.ko

- `linked/<단어>.json` (2026-10-24): `generator=links&prop=extracts&exintro=1&explaintext=1&exlimit=20&exchars=300` 응답 (연결 문서 첫 문단)
- `parse/<단어>.json` (2026-10-28): `action=parse&prop=text|links` 응답 (뜻 모음 문서 HTML과 연결 목록). 실제로 실행한 명령(저장소 루트에서):

```bash
mkdir -p tests/unit/fixtures/disambiguation/parse
for w in 모델 버블 커널 터미널 스레드 트리거 마진 포트 플랫폼; do
  curl -sS -G -A "DragAndFind-fixtures/1.0 (maestro001220@gmail.com)" "https://ko.wikipedia.org/w/api.php" \
    --data-urlencode "action=parse" --data-urlencode "page=$w" --data-urlencode "prop=text|links" \
    --data-urlencode "formatversion=2" --data-urlencode "disabletoc=1" \
    --data-urlencode "disableeditsection=1" --data-urlencode "disablelimitreport=1" \
    --data-urlencode "format=json" \
    -o "tests/unit/fixtures/disambiguation/parse/$w.json"
done
```
