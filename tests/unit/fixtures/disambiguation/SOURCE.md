# 출처

이 폴더의 JSON은 2026-10-24에 한국어 위키백과 API(`ko.wikipedia.org/w/api.php`)에서 받은 응답 사본이다.
글 내용의 저작권은 위키백과 기여자에게 있으며 CC BY-SA 4.0으로 이용한다.
https://creativecommons.org/licenses/by-sa/4.0/deed.ko

- `pages/<단어>.json`: `prop=extracts|pageprops&explaintext=1` 응답 (뜻 모음 문서 본문 글자)
- `parse/<단어>.json`: 2026-10-28에 받은 `action=parse&prop=text|links&formatversion=2&disabletoc=1&disableeditsection=1&disablelimitreport=1&format=json` 응답 (뜻 모음 문서 HTML과 연결 목록). `curl -G`로 `ko.wikipedia.org/w/api.php`에 `page=<단어>`와 함께 보냄
- `linked/<단어>.json`: `generator=links&prop=extracts&exintro=1&explaintext=1&exlimit=20&exchars=300` 응답 (연결 문서 첫 문단)
