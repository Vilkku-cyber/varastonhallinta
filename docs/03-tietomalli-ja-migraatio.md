> HISTORIALLINEN SUUNNITELMA: käyttäjä rajasi Firebase Functionsin pois 9.9.2026. Nykyinen toteutus ja sitä koskevat päätökset ovat tiedostossa [05-toteutus-ja-jatko.md](05-toteutus-ja-jatko.md). Alla olevia palvelinsuunnitelmia ei ole otettu käyttöön.

# Tietomalli, samanaikaisuus ja migraatio

Suunnittelupäätös, ei tuotantoon asennettu skeema. Tallennusmuodoille tehdään TypeScript-tyypit ja ajonaikaiset validaattorit ensimmäisessä sovellustoimituksessa.

## Tietomalli

Uusi tuotantoversio käyttää erillistä v2-nimiavaruutta tai erillistä RTDB-instanssia. Testit käyttävät paikallista emulaattoria tai erillistä testiprojektia. Vanha selain ei saa kirjoittaa v2-rakenteisiin.

| Polku v2:n alla | Sisältö ja invariantit |
|---|---|
| catalog/products/{productId} | name, categoryId, trackingMode: quantity/serial, notes, dimensionsText, weightText, optional weightKg, lifecycle: active/retired, version |
| catalog/units/{unitId} | productId, serial, damageNotes, lifecycle; unitId on pysyvä tunniste eikä raakaa sarjanumeroa käytetä polkuna |
| operations/stock/{productId} | quantityTotal quantity-tuotteelle; serial-tuotteen kapasiteetti vahvistetuista yksilöistä; huollossa/poissa käytöstä olevat erotellaan |
| operations/units/{unitId} | productId, serviceState, checkoutTripId tai null; fyysinen lainaus ja huoltotila samassa transaktiorajassa |
| operations/trips/{tripId} | schemaVersion:2, name, contact, startDate, endDate, timezone, status, version, createdAt/By, updatedAt/By, items, packedItems, returns |
| operations/commandReceipts/{commandId} | uid, payloadHash, result, committedAt; duplikaattikomento ei muuta saldoja uudelleen |
| operations/auditEvents/{eventId} | komentotyyppi, kohde, tekijä, aika ja muutoksen rajattu kuvaus; ei salasanoja eikä koko yhteystietosisältöä |
| locations/{locationId} | shelfId, aisleId, levelId; hylly- ja tasotunnisteet erillisiä, eivät A111-merkkijonon jäsentämisen varassa |
| shelves/{shelfId} | näyttönimi, direction, välien ja tasojen järjestys |
| placements/{placementId} | productId tai unitId, locationId, quantity tai null; yksi sijoittelutotuus, monipaikkaisuus sallittu |
| shelfNotes/{noteId} | locationId, text, legacySourcePath; käsin lisätyt tavaramerkinnät ilman vahvistettua tuotetta |
| plannerProfiles/{profileId} | version, paneelien mitat mm, pikselit, asennus-/kaapelisäännöt, tarvittavien roolien productId-mäppäys |
| plannerPlans/{planId} | syöte, profileVersion, laskettu kalustolista, actualWidth/Height, syntyaika |
| tasks/{taskId} | text, done, createdAt/By, updatedAt/By |
| access/users/{uid} | enabled ja role: viewer/operator/admin; palvelin ylläpitää |
| migrationReview/{reviewId} | poikkeaman tyyppi, lähdepolku, ehdokasratkaisut, päätös ja tekijä; vain ylläpito |

Operatiivinen määrä ja lainaus ovat operations-haarassa, jotta kapasiteetin tarkistus, keikan muutos ja kuittaus voidaan tehdä yhdessä transaktiossa. catalog sisältää kuvailevaa tietoa. Palvelin luo tuotteen operatiivisen tietueen hallitusti; keskeneräistä tuotetta ei voi varata. Sekä catalog- että operations-rakenteessa esiintyvät productId-viittaukset eivät ole kaksi saldoa.

### Keikkarivit

```ts
type Item =
  | { type: 'inventory'; productId: string; quantity: number; nameSnapshot: string; note: string }
  | { type: 'custom'; name: string; quantity: number; note: string };

// items/{itemId}: Item. itemId on generoitu, ei tuotteen nimi.
// packedItems/{itemId}: { quantity, unitIds: Record<string, true>, nameSnapshot }
// returns/{itemId}: { quantityReturned, units: Record<string, ReturnOutcome> }
// ReturnOutcome: palautettu / huoltoon / kadonnut, aika ja tekijä.
```

Määrät ovat äärellisiä kokonaislukuja. Suunnitelmarivin määrä on >0. Quantity-pakkaus ei voi olla negatiivinen. Serial-rivin pakattu määrä johdetaan yksilöjoukosta; asiakas ei määrää sitä itsenäisesti. Yksilön on kuuluttava tuotteeseen, oltava pakattavissa ja vailla toisen keikan fyysistä lainaa. Palautus ei ylitä toteutunutta pakkausta. Puuttuva vanha toteuma säilyy migraatiossa eksplisiittisesti `legacyPackingUnknown`-tilana.

Keikan tilat näkyvät tutusti: pakkaamatta → pakattu → keikalla → purkamatta → palautettu. Lisäksi luonnos ja peruttu. Tilasiirtymät ovat komentoja, eivät vapaa status-kentän päivitys. Pakattu edellyttää suunnitelman täyttymistä tai kirjattua puutteen hyväksyntää. Palautettu edellyttää kaikkien lainojen käsittelyä. Historiallinen importedClosed voidaan säilyttää erillisenä migraatiotietona.

### Ajat ja saatavuus

Oletus 2.0:n ensimmäiselle versiolle: varauspäivät ovat Europe/Helsinki-kalenteripäiviä, alku- ja loppupäivä sisältyvät varaukseen. Samana päivänä palautuvaa tuotetta ei luvata uudelle keikalle automaattisesti. UTC-aikaleimat varataan tapahtumalokiin. Vanhan DatePickerin ISO-arvot muunnetaan Helsingin päiviksi, ei UTC-merkkijonon ensimmäisiä kymmentä merkkiä ottamalla. Kesä-/talviajan rajat testataan.

Saatavuus lasketaan valitun aikavälin **suurimmasta yhtäaikaisesta kuormasta**, ei kaikkien aikaväliä leikkaavien varausten summasta. Esimerkki: 10 laitetta, maanantaina 6 ja tiistaina 6 varattuna, uusi keikka ma-ti: vapaita 4, ei -2. Päiväkohtainen kuorma muodostuu aktiivisista varauksista. Muokattava keikka jätetään vanhassa muodossaan pois ja sen uusi suunnitelma tarkistetaan kokonaisuutena.

Saman keikan saman tuotteen rinnakkaiset rivit summataan. Suunnitelmaa suurempi toteutunut pakkaus varaa vähintään pakatun määrän. Ajallisen varauksen ja saman keikan fyysisen lainan vaikutusta ei lasketa kahdesti: keikka/tuote/päivä-kuorma on niiden maksimi. Loppupäivän jälkeen palauttamaton laina pysyy esteenä, kunnes palautus tai poikkeamakäsittely päättää sen. Huolto vähentää käytettävää kapasiteettia. Menneessä tai perutussa keikassa ei jää uusia suunnitteluvarauksia, mutta fyysisiä lainoja ei hävitetä tilaa vaihtamalla.

### Tallennus ja kilpailutilanteet

Komennot: createTrip, reviseTrip, packUnit, setPackedQuantity, unpackUnit, returnItems, closeTrip, changeStock, changeUnitServiceState, applyPlannerPlan. Jokaisella commandId, expectedVersion ja validoitu sisältö.

Palvelin tarkistaa Firebase ID-tokenin ja access-roolin. Sitten se suorittaa RTDB-transaktion yhteisessä operations-juuressa: lukee nykyiset varaukset ja lainat, laskee saatavuuden, tarkistaa version, tekee kaikki kyseisen komennon muutokset ja tallentaa kuittauksen. Transaktiocallback on puhdas ja uudelleenajettava. Sama commandId + eri payload/uid hylätään. Virhe ei jätä osittaista varausta. Kaikki operations-kirjoitukset käyttävät samaa kurinalaista reittiä; rinnakkaiset set/update-kutsut estetään selaimelta säännöillä.

Alkuvaiheen yhteinen transaktioraja on tietoinen yksinkertaistus pienen aineiston eheydelle. Historiakertymän kasvu, siirretyt tavumäärät, transaktion uusintamäärä ja p95-kesto mitataan ennen julkaisua. Arkistoa ei kuunnella kokonaisena selaimessa. Jos transaktioraja ei läpäise kuormakoetta, ratkaistaan ennen tuotantoa pienempi varausledger tai transaktionaalinen SQL-palvelin; pelkkää erillistä product-kohtaista lukitusta ilman monituotereservaation palautumismallia ei hyväksytä.

Sijoittelu päivitetään version tarkistavalla palvelinkomennolla. Mahdolliset hakuindeksit ovat uudelleenrakennettavia projektioita. Niistä ei päätellä pakkaus- tai varauskelpoisuutta. Komentojen kuittaus- ja audit-retentio määritellään niin, ettei vanhan komentotunnuksen uusinta aiheuta toista palautusta.

Säännöt: oletusarvoisesti ei pääsyä; sallittu käyttäjä saa vain tarpeelliset lukupolut, viewer ei komento-oikeutta, operator operatiiviset komennot, admin kaluston ja oikeuksien hallinnan. Admin SDK ohittaa RTDB-säännöt, joten palvelinkomentojen valtuutus ja validointi testataan erikseen. allowedUsers-export ei korvaa tätä. Security Rules ja indeksit versionhallintaan, Auth/RTDB-emulaattorit testiin.

## Migraation muunnossäännöt

| Lähde | Muunnos | Epäselvä tapaus |
|---|---|---|
| inventory, name olemassa | productId säilyy; available on quantityTotal-ehdokas koodin perusteella | 6 yksilömääräristiriitaa ratkaistaan ennen serial-tilan aktivointia |
| inventory vain shelfLocation | hyllymerkintäehdokas | ei tehdä nollamääräistä tuotetta automaattisesti |
| nimetön keloja-tietue | säilytetään raakana ja tarkistusjonossa | käyttäjä määrittää merkityksen |
| details + additionalInfo | molemmat tekstit talteen, yhdistetty notes lähdemerkinnöin | 7 eri sisältöä ei korvata toistensa yli |
| units/{serial} | uusi unitId, serial arvoksi, legacy-map talteen | epäselvät tai puuttuvat yksilöt tarkistukseen |
| items array/object | yksi items/{itemId} muoto, productId ensisijaisesti rivin id:stä | taulukkoindeksiä ei käytetä productId:nä |
| packedItems manual-* | ensin tunnistus lähderivin/keikan tuotteista; mapping tallennetaan | nimitäsmäys on ehdotus, ei varma identiteetti; ratkaisematon säilyy legacy-rivinä |
| packedItemsin sisäinen taulukko / manualItems | oma adapteri, lähdepolku säilyy | poikkeava muoto ei katoa object-spreadissa |
| puuttuva arkistotuote | historiallinen snapshot/tombstone | ei muuteta aktiiviseksi custom-tuotteeksi merkitystä hukaten |
| shelves sparse arrays | iterointi alkuperäisillä avaimilla, null-ohitus | välien/tasojen numeroita ei tiivistetä |
| shelfLocation ja shelves eri mieltä | säilytetään molemmat lähteet tarkistusjonossa | ei valita pisintä/ensimmäistä/viimeistä sijaintia automaattisesti |
| arkiston 3 virheellistä aikaväliä | alkuperäiset arvot ja päivämääräpoikkeama säilyvät | näkyvät historiassa, eivät uusia aktiivisia varauksia |
| allowedUsers | erillinen oikeuksien siirtosuunnitelma | ei tuoda suoraan Auth-käyttäjiksi |

`trackingMode` ei perustu kategoriaan. `available`-kenttää ei lasketa yhteen units-määrän kanssa. Historiallisista rivimääristä tai saldoista ei päätellä lainauksen puuttuvia tapahtumia. Mittojen/painon vapaatekstit säilytetään, numeeriset arvot luodaan vain varmasti jäsennettävistä yksiköistä.

## Vaiheet ja eheysportit

1. Tallenna lähde-export muuttamattomana yksityiseen säilytykseen ja SHA-256 manifestiin. Nykyinen audit-raportti sisältää hashin. Ennen julkaisua tarvitaan tuore live-export; tämän tiedoston ajantasaisuutta ei oleteta.
2. Toteuta offline-normalisoija. Syöte + skeemaversio + päätösmapping tuottavat deterministisen tuloksen ja lähde-ID-kartan. Tuntemattomat kentät säilyvät legacy-liitteessä. Työkalu ei sisällä tuotantotunnuksia.
3. Dry-run tuottaa ehdokas-v2:n, poikkeamat sekä vertailun. Jokainen 345 inventory-lähdetietueesta on joko tuote, hyllymerkintä tai säilytetty tarkistustietue. Pelkkä tuotemäärä 345→345 ei ole oikea tavoite.
4. Varmista 6 aktiivisen ja 118 arkistokeikan tunnisteiden säilyminen; jokaisen suunnitelma- ja pakkausrivin määrä, jokaisen sarjanumeron joukko sekä custom-tekstit täsmäävät lähteeseen. Puuttuva, nolla ja ratkaisematon pidetään eri tiloina. Hyllyrakenteiden suunnat ja paikkaviitteet säilyvät. Tarkistusjono on laskettava, ei hiljainen hävikkilista.
5. Tuo ehdokas emulaattoriin ja tee export takaisin. Vertaa normalisoitua rakennetta huomioiden RTDB:n tyhjien objektien/nullien käyttäytyminen. Toista migraatio: samat tunnisteet, ei duplikaatteja. Testaa keskeytys ja uudelleenajo.
6. Käy epäselvyydet läpi ylläpitonäkymässä tai yksityisessä mapping-tiedostossa. Aktiivisen käytön kapasiteetti-/identiteettipoikkeamat estävät julkaisun. Historiallinen ratkaisematon tieto saa säilyä näkyvästi merkittynä vain, jos se ei estä historian oikeaa lukemista.
7. Testiprojektissa päästä päähän -testit, kaksi käyttäjää ja palautusharjoitus. Auth-oikeudet, säännöt ja hosting-konfiguraatio tarkistetaan samalla. Firebase-export ei sisällä Auth-salasanoja tai deploy-asetuksia.
8. Käyttöönoton kirjoitustauko: vanha sovellus lukutilaan palvelinsäännöillä, viimeinen export, hash, migraatio uuteen nimiavaruuteen, vertailu ja 2.0:n avaus. Ei vanhan ja uuden rinnakkaista kirjoittamista samaan liiketoimintadataan.
9. Ennen ensimmäistä v2-kirjoitusta palautuminen = vanha sovellus ja vanha data. Sen jälkeen vanhan exportin palautus hävittäisi uudet tapahtumat: molempien kirjoitukset pysäytetään, v2-export ja komentoloki talteen, uudet tapahtumat sovitetaan ennen paluuta. Tämä jälkikirjoitusten palautus harjoitellaan etukäteen.

Nykyinen auditointityökalu suorittaa vain rakenteellisen lähtökartoituksen. Vaiheita 2–9 ei ole merkitty tehdyiksi eikä kirjoittavaa migraatiota ajettu.

