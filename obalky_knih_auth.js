var obalkyKnihAuth=new Object();
// funkce pro ziskani identifikatoru Narodnni autority
// Hleda se v tabulce s udaji autority, jejiz 
//      1. <table> element musi mit atribut id="table-accref-body"
//      2. radek s identifikatorem Nar. autority ma prvni sloupec obsahujici text "Ident. číslo" a druhy sloupec obsahuje (jen) identifikator autority
obalkyKnihAuth.getIdentifier = function() {
   var tab2search=document.querySelectorAll('#table-accref-body');
   if (tab2search.length==0) {console.warn('Tabulka s id="table-accref-body" nenalezena. Ma to byt hlavni tab. s udaji autority'); return;}
   for (var i=0; i<tab2search[0].rows.length; i++) {
      var row2search = tab2search[0].rows[i];
      var cellText=(row2search.cells[0].innerText || row2search.cells[0].textContent);
      if ( cellText.indexOf('Ident. číslo')>-1 || cellText.indexOf('Control Nr')>-1 ) { return ( row2search.cells[1].innerText || row2search.cells[1].textContent ).trim(); }
      }
   console.warn('V tabulce s id="table-accref-body" nenalezen radek obsahujici v prvnim sloupci text "Ident. číslo". Nemohu dohledat identifikator autority...');
   return '';
   }
obalkyKnihAuth.ask = function() {
   obalkyKnihAuth.id=obalkyKnihAuth.getIdentifier();
   if ( obalkyKnihAuth.id=='' ) { console.warn('Identifikator Narodni autority nenalezen. Nelze nacist API obalkyknih.cz'); return; }
   if ( typeof JSON == 'undefined' ) {console.warn('Vas prohlizec nepodporuje objekt JSON, nelze nacist data z obalkyknih.cz!'); return; }
   if (typeof XMLHttpRequest == "undefined") {console.warn('Vas prohlizec nepodporuje objekt XMLHttpRequest, nelze nacist data z obalkyknih.cz!'); return; }
   if ( typeof obalkyKnih_domain ==  'undefined') { 
         console.warn('obalky_knih.js error - promenna obalkyKnih.domain neexistuje, ma se nacitat do tail sablony pres <include>obalkyknih-url-js'); return; } 
   //a e volani api
   //volani pres mod_proxy Apache obcas nevratilo nic nebo vratilo neuplnou odpoved (oseklou na konci, nevalidni json objekt]. Matyas Bajger 15.10,2015:q
   //obalkyKnihAuth.url= '/obalky/'+obalkyKnih_domain+'/api/auth/meta?auth_id='+obalkyKnihAuth.id);
//jina mozna varianta presmerovani nez pres mod_apache, tak cgi skriptem   
   obalkyKnihAuth.url= '/cgi-bin/uncgi/redir.cgi?redd=' + encodeURI('http://'+obalkyKnih_domain+'/api/auth/meta?auth_id='+obalkyKnihAuth.id);
   obalkyKnihAuth.request = new XMLHttpRequest();
   obalkyKnihAuth.request.open('GET',obalkyKnihAuth.url,true);
   obalkyKnihAuth.request.send();
   obalkyKnihAuth.request.onreadystatechange=function () {
      if (obalkyKnihAuth.request.readyState==4 && obalkyKnihAuth.request.status==200 ) {
	 obalkyKnihAuth.json = '';
	 if ( obalkyKnihAuth.request.responseText.trim() == "" || obalkyKnihAuth.request.responseText.trim() == "[]" ) { console.log('Odpoved API obalkyknih.cz je prazdna'); } 
	 else if ( obalkyKnihAuth.request.responseText.indexOf('[{')==-1 && obalkyKnihAuth.request.responseText!='[]') { console.warn('Odpoved API obalkyknih.cz: "'+obalkyKnihAuth.request.responseText+'"  nevypada jako JSON objekt'); }
	 else {  
            var respt=obalkyKnihAuth.request.responseText; //ver1.1
	    if ( respt.match(/"[\}]+\]$/) == null ) {  console.warn('Odpoved API se zda byt neuplna. Pokousim se opravit JSON objekt'); respt=respt+'"}]'; } 
	    obalkyKnihAuth.json = JSON.parse(respt); }
	 if ( obalkyKnihAuth.json[0].length==0 ) { console.error ('API odpoved obalkyknih.js je prazdny json objekt...'); return; } 
         if ( typeof obalkyKnihAuth.json[0].cover_medium_url != 'undefined' ) { obalkyKnihAuth.showPortrait(); }
         if ( typeof obalkyKnihAuth.json[0].links != 'undefined') { obalkyKnihAuth.showWiki(); }
	 }
      }
   }
//funkce pro zobrazeni ziskanych dat z obalkyknih.cz
obalkyKnihAuth.showPortrait = function() {
   var targetEl= document.querySelectorAll('#ob_portrait')[0];// tento html element <div id="ob_portrait"></div> (nebo jiny html tag s timto atributem id) umistete na stranku, 
   if ( targetEl==null ) {console.warn('Element pro umisteni portretu z API obalkyknih.cz neexistuje!');return;}
   if ( obalkyKnihAuth.json[0].cover_medium_url=='' ) {console.warn('Odpoved API cover_medium_url je prazdny retezec - mel by byt URL obrazku'); return;}
   if ( obalkyKnihAuth.json[0].cover_medium_url.match(/^\s*http[s]*:\/\//).length == 0) {console.warn('Odpoved API cover_medium_url neobsahuje URL : '+obalkyKnihAuth.json.cover_medium_url); return;}
   var backlink=( obalkyKnihAuth.json[0].backlink_url || '' );
   if ( backlink!='') { var portrait=document.createElement('a'); portrait.href=backlink; }
   else { var portrait=document.createElement('span'); }
   portrait.innerHTML= '<img src="'+obalkyKnihAuth.json[0].cover_medium_url+'" alt=""><br><img src="/obalky_dir/logo_obalkyknih.png" alt="">';
   targetEl.appendChild(portrait);
   targetEl.style.display='';
   }
obalkyKnihAuth.showWiki = function() {
console.log('showWiki start');
   var targetEl= document.querySelectorAll('#ob_wiki_link')[0];// tento html element <div id="ob_wiki_link"></div> (nebo jiny html tag s timto atributem id) umistete na stranku, kde maji bzt odkayz na wiki, jez vratilo API.
   if ( targetEl==null ) {console.warn('Element pro umisteni odkazu na wikipedii v API obalkyknih.cz neexistuje!');return;}
   if ( obalkyKnihAuth.json[0].links.length==0 ) {console.log('Odpoved API obalkyknih.cz neobsahuje zadny objekt links s odkazy na dalsi info.'); return; }
   for ( var i=0; i<obalkyKnihAuth.json[0].links.length; i++ ) {
console.log('i='+i);
      var link=obalkyKnihAuth.json[0].links[i];
console.log('link = '+link);
console.log('link.source_name = '+link.source_name);
console.log('link.link = '+link.link);
window.deb=link;
console.log('step 1');
      if ( typeof link.source_name == 'undefined' ) {continue;}
console.log('step 2');
      if ( link.source_name != 'Wikipedie' ) {continue;}
console.log('step 3');
      if ( typeof link.link != 'undefined') { if ( link.link.trim() !='' && link.link.match(/^\s*http[s]*:\/\//).length > 0) {
console.log('creating wiki link');
	 var wikiLink=document.createElement('a');
	 wikiLink.href=link.link; wikiLink.target='_blank'; wikiLink.title=(link.title || '');
	 wikiLink.innerHTML = '<img src="/obalky_dir/Wikipedia-logo-v2-cs.png" alt="Wikipedie.cz">'
	 targetEl.appendChild(wikiLink);
	 targetEl.style.display='';
	 } }
      }
   }
