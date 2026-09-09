# Julkaisutilanne 9.9.2026

Nykyinen tuotanto on https://av-arsenal.vercel.app. Käyttäjän Vercel-kuvassa se seuraa GitHubin Vilkku-cyber/varastonhallinta-repositorion main-haaraa (dc683d1). Uusi sovellus tallennetaan erilliseen codex/av-arsenal-2-haaraan. Main-haaraa ei päivitetä ennen tietokantasiirron valmistumista.

## Valmis tässä muutoksessa

- Alkuperäinen varastokartta ja kartalta avautuvat hyllyvälit/tasot.
- Tuote-, sarjanumero- ja hyllyosoitehaku, useat sijainnit ja hakutuloksen korostus.
- Tallennetun hyllyn vasen/oikea lukusuunta ja numeerinen tasojärjestys.
- 19 automaattista testiä ja build läpäisty. Selaimessa A11-haku ja tuloksesta hyllypaikkaan siirtyminen todennettu.
- Vercel-build keskeytyy, jos Firebase-tila tai ympäristöasetukset puuttuvat. Firebase-adapteri ilmoittaa puuttuvasta v2-tietokannasta tyhjän työtilan avaamisen sijaan.

## Julkaisun este

Paikallinen esikatselu tallentaa IndexedDB:hen. Firebase-adapteri käyttää erillistä avArsenalV2/state-polkua, mutta tuotannon siirtoa, käyttöoikeuksia ja sääntöjä ei ole otettu käyttöön. Kirjautumattomat tarkistukset palauttivat 401 (v2-polku) ja 403 (säännöt); nämä eivät todenna kirjautuneen käytön toimivuutta tai tietojen olemassaoloa. Hallintayhteyttä Firebaseen ei ole käytettävissä tässä työympäristössä. GitHub-yhteys toimii.

Tarvitaan Firebase-hallintayhteys, ajantasainen varmuuskopio sekä dokumentin 05 migraatio- ja käyttötestit ennen tuotannon korvaamista. Firebase Functions ei kuulu toteutukseen. Vanhaan tuotantotietokantaan ei ole kirjoitettu.

Vercelin asetuksissa uuden haaran sovellus on repositorion juuressa (vanha sovellus frontend-kansiossa). Root Directory on tarkistettava julkaisun yhteydessä, samoin Firebase-ympäristöasetukset. Pelkkä GitHub-push ei ratkaise tietokantasiirtoa.
