//ver 1.2 - zmeny nejsou zaznaceny, doslo k prepracovani cele struktury funkci.
//ver 1.3 - pridan dig_obj : link na digitalizovany objekt Kramerius
//ver 1.3.1 - Repair od full text TOC upload to BIB records - if the record was to long (more than 45000 bytes), it was not trimmed, but sent to upload to database by manage-18. This caused to removal of some other BIB fields at the end of the records. Although this was reported by email, this needed manual repair of the record. 
//ver 1.3.2 - dig_obj: elements "name" and "logo" added to api response, considering the name and logo of a digital library
//            new logging of clicks to digital objects. function logit() calls new script /cgi-bin/log_link.cgi?link='+encodeURI(x)  
//            czech characters with diacritic converted to html entities 



var obalkyKnih=new Object();
//pomocne funkce pro ziskani identifikatoru
var identifiers=new Object;
identifiers.getISBNs = function() { //najde ISBN (10+13), ISSN i ISMNa, vraci je v poli
   //var isbnRegex=new RegExp('(([^\\d](97[8|9][\\- ])?[\\dM][\\d\\- ]{10}[\\- ][\\dxX])|([^\\d](97[8|9])?[\\dM]\\d{8}[\\dXx]))|([^\\d]\\d{4}\\-[\\dxX]{4})[^\\d]','g');
   //correction of regex issn value - 20160205
   var isbnRegex=new RegExp('(([^\\d](97[8|9][\\- ])?[\\dM][\\d\\- ]{10}[\\- ][\\dxX])|([^\\d](97[8|9])?[\\dM]\\d{8}[\\dXx]))|([^\\d]\\d{4}\\-[\\dxX]{4})[^\\d\'"]','g');
   var bodyText=(document.body.textContent || document.body.innerText);
   var isbnF=(bodyText.match(isbnRegex));
   if ( isbnF==null) {return [];}
   isbnF=identifiers.removeCancelledIds(isbnF,'!',9,17);
   //get unique values
   isbnF.sort();
   for ( var i=0; i<isbnF.length; i++ ) {
      if ( isbnF[i].match(/^[\d]{4}\-[\dxX]{4}.{1}/) ) { isbnF[i]=isbnF[i].slice(0,-1); } //oprava issn - posledni znak rusil. 29.2/2016
      if ( isbnF[i] === isbnF[i-1] ) isbnF.splice(i--, 1);
      }
   //isbn validity check
   for ( i=0; i<isbnF.length; i++ ) {
      var isbn2check = (isbnF[i].replace(/^\s?M\-?/,'979-0-')).replace(/[^\dxX]/g,'');
      var checkSum=0;
      if ( isbn2check.length == 10 ) {  //ISBN-10
	 for ( var j=0; j<10; j++ ) checkSum += (10-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10));
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--; } }
      else if ( isbn2check.length == 13 ) { //ISBN-13, ISMN (10+13)
	 for ( j=0; j<13; j++ ) checkSum += ( ( j%2==0 ) ? 1 : 3 ) * parseInt(isbn2check.charAt(j));
         if ( checkSum%10!=0) { isbnF.splice(i,1); i--; } }
      else if (  isbn2check.length == 8 ) { //ISSN
	 for ( var j=0; j<8; j++ ) checkSum += (8-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10)); 
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--;  }
         }
      else { isbnF.splice(i,1); i--; }
      }
//EAN code - zpracovava se obalkama jako isbn - ver 1.1 (nasl. 3 radky)
   var eans = (((document.body.textContent || document.body.innerText).match(/EAN\s{0,1}\d{8,14}/g)) || []);
   for ( var i=0; i<eans.length; i++ ) { eans[i] = eans[i].replace(/EAN\s/,'');}
   if ( eans.length>0 ) {isbnF.push(eans);}
//
   return isbnF;
   }
identifiers.getOCLCno = function() {
   var oclcF = (document.body.textContent || document.body.innerText).match(/.\(OCoLC\)\d+/g);
   if ( oclcF==null) return [];
   oclcF=identifiers.removeCancelledIds(oclcF,'!',10,20);
   if (typeof oclcF == 'string') var oclcF=[oclcF]; 
   return oclcF;
   }
identifiers.getCNB = function() {
   var cnbF = (document.body.textContent || document.body.innerText).match(/.cnb\d+/g);
   if (cnbF==null) return [];
   cnbF=identifiers.removeCancelledIds(cnbF,'!',5,13);
   if (typeof cnbF == 'string') var cnbF=[cnbF]; 
   return cnbF;
   }
identifiers.removeCancelledIds = function(IDarray,mark,minLength,maxLength) {
   for (var i=0; i<IDarray.length; i++) {
	if (IDarray[i].substr(0,1)==mark) {IDarray.splice(i,1); i--; }
	else {
	   IDarray[i]=IDarray[i].substr(1);
	   if ( IDarray[i].length<minLength || IDarray[i].length>maxLength ) { IDarray.splice(i,1); i--; }
	   }
	}
   return IDarray;
   }
//sestavi identifikatory a udaje o dok. do dotazu pro volani api
obalkyKnih.setQuery = function(partNote,partName) {
   var partNote=(partNote ? partNote : '').replace(/.*<br>.*/,'','i'); 
   var partName=(partName ? partName : '').replace(/.*<br>.*/,'','i');;
   var isbns=(isbns ? isbns : identifiers.getISBNs()); 
   var oclcs=(oclcs ? oclcs : identifiers.getOCLCno()); 
   var cnbs=(cnbs ? cnbs : identifiers.getCNB());
   if ( isbns.length+oclcs.length+cnbs.length==0) {return;} 
   if (typeof obalkyKnih.uri_multi === 'undefined' ) { obalkyKnih.uri_multi='[{'; }
   if ( encodeURI(encodeURIComponent(obalkyKnih.uri_multi)).length>7000 ) { console.log('Too many records/items to call obalkyknih.cz API for all of them. Trimming.');return;} //default apache limit for URI length is 8190 chars
   else { obalkyKnih.uri_multi = obalkyKnih.uri_multi.replace(/\}\]\s*$/,'},{'); }
   for (var i=0; i<isbns.length; i++) { obalkyKnih.uri_multi += ',"isbn":"'+isbns[i]+'"'; }    
   for (i=0; i<oclcs.length; i++) { obalkyKnih.uri_multi += ',"oclc":"'+oclcs[i]+'"'; }
   for (i=0; i<cnbs.length; i++) { obalkyKnih.uri_multi += ',"nbn":"'+cnbs[i]+'"'; }
   if ( partNote!='') { obalkyKnih.uri_multi += ',"part_note":"'+partNote+'"'; } 
   if ( partName!='') { obalkyKnih.uri_multi += ',"part_name":"'+partName+'"';}  
   obalkyKnih.uri_multi=obalkyKnih.uri_multi.replace(/\{,/g,'{');
   obalkyKnih.uri_multi=obalkyKnih.uri_multi.replace(/\s*$/,'}]');
   obalkyKnih.partNameAr = ( obalkyKnih.partNameAr ? obalkyKnih.partNameAr : new Array() );  obalkyKnih.partNameAr.push(partName);
   }
//hlavni funkce pro komunikaci s api obalkyknih
obalkyKnih.ask = function(base) { 
   obalkyKnih.base=(base ? base : ''); 
   if ( typeof JSON == 'undefined' ) {console.warn('Vas prohlizec nepodporuje objekt JSON, nelze nacist data z obalkyknih.cz!'); return; }
   if (typeof XMLHttpRequest == "undefined") {console.warn('Vas prohlizec nepodporuje objekt XMLHttpRequest, nelze nacist data z obalkyknih.cz!'); return; }
   if ( typeof obalkyKnih.domain == 'undefined') { 
	 console.error('obalky_knih.js error - promenna obalkyKnih.domain neexistuje, ma se nacitat do tail sablony pres <include>obalkyknih-url-js'); return; }
   if (typeof obalkyKnih.uri_multi == 'undefined'  && window.location.href.indexOf('func=item-global')==-1 ) {obalkyKnih.setQuery();}
   if ( obalkyKnih.uri_multi == '' && window.location.href.indexOf('func=item-global')==-1 ) {obalkyKnih.setQuery();}
   if ( (obalkyKnih.uri_multi || '').indexOf('isbn') + (obalkyKnih.uri_multi || '').indexOf('oclc') + (obalkyKnih.uri_multi || '').indexOf('nbn') < -2 ) {return;} //nejsou zadne identifikatory dok.
   //a samotne volani api
   //ver 1.1
   //volani pres mod_proxy Apache obcas nevratilo nic nebo vratilo neuplnou odpoved (oseklou na konci, nevalidni json objekt]. Matyas Bajger 15.10,2015:q
   //obalkyKnih.url= '/obalky/'+obalkyKnih.domain+'/api/books?multi=' + encodeURIComponent(obalkyKnih.uri_multi);
//jina mozna varianta presmerovani nez pres mod_apache, tak cgi skriptem   
   obalkyKnih.url= '/cgi-bin/redir.cgi?redd=' + encodeURI('http://'+obalkyKnih.domain+'/api/books?multi=' + encodeURIComponent(obalkyKnih.uri_multi));
   obalkyKnih.request = new XMLHttpRequest();
   obalkyKnih.request.responseType = 'text'; //ver 1.3 - oprava hlavicky AJAX pro JSON, request je prijiman primarne jako text a pak az json parsovan
   obalkyKnih.request.open('GET',obalkyKnih.url,true);
   obalkyKnih.request.send();
   obalkyKnih.request.onreadystatechange=function () {
      if (obalkyKnih.request.readyState==4 && obalkyKnih.request.status==200 ) {
	 obalkyKnih.json = '';
         obalkyKnih.request.jsonWarn=false; //ver 1.1
	 if ( obalkyKnih.request.responseText.trim() == "" || obalkyKnih.request.responseText.trim() == "[]" ) { console.log('Odpoved API obalkyknih.cz je prazdna'); } //ver 1/1
	 else if ( obalkyKnih.request.responseText.indexOf('[{')==-1 && obalkyKnih.request.responseText!='[]') { console.warn('Odpoved API obalkyknih.cz: "'+obalkyKnih.request.responseText+'"  nevypada jako JSON objekt'); }
	 else {  //ver1.1
            var respt=obalkyKnih.request.responseText; //ver1.1
	    if ( respt.match(/"[\}]+\]$/) == null ) {  console.warn('Odpoved API se zda byt neuplna. Pokousim se opravit JSON objekt'); respt=respt+'"}]';  obalkyKnih.request.jsonWarn=true; } //ver 1.1
	    obalkyKnih.json = JSON.parse(respt); } //ver 1.1
	 if ( obalkyKnih.json.length==0 ) { return; } 
	 for (var i=0; i<obalkyKnih.json.length; i++) {
	    var obj=obalkyKnih.json[i];
	    if ( obalkyKnih.partNameAr[i]!='' && obalkyKnih.partNameAr[i]!=obj.bibinfo.part_name ) {continue;} //pojmenovani casti ve volani api a v jeho odpovedi se neshoduji. obalka muze patrit jine casti dok.
	    //nahled obalky obj.cover_medium_url (170x240px) lze zmenit za mensi nahled nahradou za: cover_icon_url (54x68px)
	    if ( typeof obj.cover_medium_url!= 'undefined' ) { if (obj.cover_medium_url!='') {
		var backlink = typeof obj.backlink_url!='undefined' ? obj.backlink_url : '';
	        obj.cover_medium_url = obj.cover_medium_url.replace(/http[^:]*:/,window.location.protocol); //ver 1.1
		obalkyKnih.showCover( obj.cover_medium_url, backlink, i );
		} }
	    //obsah PDF
	    if ( typeof obj.toc_pdf_url != 'undefined' ) { if (obj.toc_full_text!='') {
		var tocThumbnail = typeof obj.toc_thumbnail_url != 'undefined' ? obj.toc_thumbnail_url : '';
		tocThumbnail = tocThumbnail.replace(/http[^:]*:/,window.location.protocol); //ver 1.1
		obalkyKnih.showTOC( obj.toc_pdf_url, tocThumbnail, i );
		} }
	    //hodnoceni
	    if ( (typeof obj.rating_url + typeof obj.rating_avg5 + typeof obj.rating_avg100 + typeof obj.rating_count).indexOf('undefinded') == -1  && location.href.indexOf('func=item-global')==-1 ) { //posledni podminka potlaci zobrazeni hodnoceni na strance jednotek
                //1. VARIANTA PRO JEDNODUCHE ZOBRAZENI IMG Z OBALKYKNIH.CZ, BEZ MOZNOSTI PRIDAVANI
		//if ( obj.rating_url!='') { obalkyKnih.showRatingSimple(obj.rating_url, backlink); }
		//2. VARIANTA PRO UPLNE ZOBRAZENI VLASTNIM SKRIPTEM S PRIDAVANIM HODNOCENI
		obalkyKnih.showRating(obj.book_id, parseFloat(obj.rating_avg5), parseInt(obj.rating_avg100), parseInt(obj.rating_count));
		}
	    //komentare
	    if ( window.location.href.indexOf('func=item-global')==-1 ) { obalkyKnih.showReviews(obj.book_id, obj.reviews); } //potlaci se zobrazeni ze stranky jednotek
	    //obsah v OCR, ver. 1.1
	    if ( typeof obj.toc_full_text != 'undefined' && !obalkyKnih.request.jsonWarn ) {
	     if (obj.toc_full_text!='' && (  typeof obj.bibinfo.part_note=='undefined' || typeof obj.bibinfo.part_name=='undefined') ) { 
	      if ( typeof sysno != "undefined"  ) { if ( sysno!='' ) { //upload obsahu nejede, pokud se api obsahuje info o casti dok.
		var partRoot=''; //identifikace souborneho zaznamu
		if ( typeof obj.part_root != 'undefined' ) { if (obj.part_root=='1') { partRoot='ROOT'; }}
		obalkyKnih.addOCRtoc(obj.toc_full_text,partRoot); 
		} } } }
            //anotace
	    if ( typeof obj.annotation != 'undefined' ) { if ( obj.annotation.html != 'undefined') { if ( obj.annotation.html!='' ) {  
		var ann=obj.annotation.html;
		if ( typeof obj.annotation.source != 'undefined') { if ( obj.annotation.source != '' ) {
		   ann = ann+' (zdroj: '+obj.annotation.source+')'; }}
		obalkyKnih.showAnnotation( ann, i );
		} } } 	
            //ver 1.3 digitalni objekt 
            if ( typeof obj.dig_obj != 'undefined' ) {
                obalkyKnih.showDigObj (  obj.dig_obj ) ;
	        }
	    }
	 }
      }
   }
//funkce pro zobrazeni ziskanych dat z obalkyknih.cz
obalkyKnih.showCover = function(coverImg,backlink,i) {
   var targetEl= document.querySelectorAll('#ob_cover')[i];// tento html element <div id="ob_cover"></div> (nebo jiny html tag s timto atributem id) umistete na stranku, kde ma byt obalka. Pro jednotky se muze jejich vyskyt opakovat.
   if ( targetEl==null ) {console.error('Element pro umisteni nahledu obalkyknih.cz neexistuje!');return;}
   var obCover = document.createElement('a');
   obCover.href = backlink;
   obCover.title = 'Zobrazit ob&aacute;lku a dal&scaron;&iacute; info na str&aacute;nce obalkyknih.cz';
   obCover.innerHTML='<img src="'+coverImg+'" alt="" '+(document.location.href.indexOf('func=item-global')>-1 ? 'width="70px"' : '')+'>'; // na strance jdenotek je obalka zmensena na 70px
   if (document.location.href.indexOf('func=item-global')==-1) { obCover.innerHTML += '<br><img src="/obalky_dir/logo_obalkyknih.png" alt="">';} // na strance jdenotek je obalka i obsah  v 1 radku
   targetEl.appendChild(obCover);
   targetEl.style.display='';
   }
obalkyKnih.showTOC = function(pdfURL, thumbnail, i) {
   var targetEl= document.querySelectorAll('#ob_toc')[i];//tento html element <div id="ob_toc"></div> (nebo jiny html tag s timto atributem id)  umistete na stranku, kde ma byt nahled a link na obsah
   if ( targetEl==null ) {console.error('Element pro umisteni pdf obsahu z obalkyknih.cz neexistuje!');return;}
   var obTOC = document.createElement('a');
   obTOC.href = pdfURL; 
   var obTOC2 = document.createElement('img');
   obTOC2.src = thumbnail;
   obTOC2.width = ( document.location.href.indexOf('func=item-global')>-1 ? '70' : '170'); //lze nastavit jinou velikost nez 70 pro jednotky z 170 jinak  nebo radek vyloucit a spolehnout se na originalni velikost
   obTOC2.style.margin='2%';
   obTOC2.alt = 'OBSAH'; //text, pokud se obrazek nenacte
   obTOC2.title = 'Klikn&ecaron;te pro zobrazen&iacute; obsahu';
   obTOC.appendChild(obTOC2);
   targetEl.appendChild(obTOC);
//targetEl.innerHTML='<a href="'+pdfURL+'"><img src="'+thumbnail+'" alt="obbbsah"></a>';
   targetEl.style.display='';
   (document.getElementById('ob_toc_head') || document.createElement('div')).innerHTML='&Ccaron;&aacute; k&oacute;d, ob&aacute;lka';
   }
obalkyKnih.showAnnotation = function(annotation, i) {
   var targetEl= document.querySelectorAll('#ob_annotation')[i];//tento html element <div id="ob_annotation"></div> umistete na stranku, kde ma byt zobrazena anotace
   if ( targetEl==null ) {console.error('Element pro umisteni anotace z obalkyknih.cz neexistuje!');return;}
   var obAnn = document.createTextNode( annotation );
   var br = document.createElement('br');
   targetEl.appendChild(obAnn);
   targetEl.appendChild(br);
   targetEl.style.display='';
   }
obalkyKnih.showRatingSimple = function(starsURL, backlink) {
   var targetEl=document.querySelectorAll('#ob_rating')[0]; //tento html element <div id="ob_rating"></div> umistete na stranku, kde ma byt zobrazeno hodnoceni 
   if ( targetEl==null ) {console.error('Element pro umisteni hodnoceni z obalkyknih.cz neexistuje!');return;}
   var obRating = document.createElement('a');
   obRating.href = backlink;
   var obRating2 = document.createTextNode('Hodnocen&icaute;: ');
   var obRating3 =  document.createElement('img');
   obRating3.src = starsURL;
   obRating3.style.verticalAlign='middle';
   obRating3.title = 'Zobrazit dal&scaron;&iacute; info na str&aacute;nce obalkyknih.cz';
   obRating.appendChild(obRating2);
   obRating.appendChild(obRating3);
   targetEl.appendChild(obRating);
   targetEl.style.display='';
   }
obalkyKnih.showRating = function(bookID,ratingAvg5,rating100,ratingCount) { 
   var targetEl=document.querySelectorAll('#ob_rating')[0]; //tento html element <div id="ob_rating"></div> umistete na stranku, kde ma byt zobrazeno hodnoceni
   if ( targetEl==null ) {console.error('Element pro umisteni hodnoceni z obalkyknih.cz neexistuje!');return;}
   ratingAvg5 = ( ratingAvg5>0 && ratingAvg5<=5 ) ? Math.round(ratingAvg5) : 0;
   targetEl.show = function () {
	while ( this.firstChild ) this.removeChild(this.firstChild); //empty the el.
        for (var i=1; i<=5; i++) {
	   var eval=document.createElement('div');
	   eval.className='ratingStar';
	   //var eval2=document.createElement('img');
	   ( i <= ratingAvg5 ) ? eval.style.backgroundImage='url(/obalky_dir/rating_plus.gif)' : eval.style.backgroundImage='url(/obalky_dir/rating_minus.gif)';
           //eval.appendChild(eval2);
           if ( typeof this.block == 'undefined') {
		eval.setAttribute('title2','Kliknut&iacute;m ohodnot&iacute;te &scaron;koln&iacute; zn&aacute;mkou: '+String(6-i).replace('1','1 (nejlep&scaron;&iacute;)').replace('5','5 (nejhor&scaron;&iacute;)'));}
	   else { eval.setAttribute('title2','Ji&zcaron; jste p&rcaron;idali hodnocen&icaute;');} 
	   eval.onmouseout=function() { targetEl.show(); }
	   this.appendChild(eval); 
	   }
	this.children[0].onmouseover=function() { targetEl.over(1); }; //cannot be set in cycle, function must be later called with actual value
	this.children[1].onmouseover=function() { targetEl.over(2); };
	this.children[2].onmouseover=function() { targetEl.over(3); };
	this.children[3].onmouseover=function() { targetEl.over(4); };
	this.children[4].onmouseover=function() { targetEl.over(5); };
	this.children[0].onclick=function() { targetEl.set(1); };
	this.children[1].onclick=function() { targetEl.set(2); };
	this.children[2].onclick=function() { targetEl.set(3); };
	this.children[3].onclick=function() { targetEl.set(4); };
	this.children[4].onclick=function() { targetEl.set(5); };
	var evalText=document.createElement('span');
	evalText.style.fontSize='80%'; 
        if ( typeof this.comment == 'undefined') this.comment='';
        if ( rating100>0 && rating100<=100 && ratingCount>0) { 
	   evalText.innerHTML = this.comment + 'Obl&iacute;benost:\xa0'+parseInt(rating100)+'% (po&ccaron;et\xa0hodnocen&iacute;:\xa0'+ratingCount+')'; }
        else if ( parseInt(ratingCount)==0 ) { 
	   (this.comment=='') ? evalText.innerHTML='Dosud nikdo nehodnotil. Bu&dcaron;te\xa0prvn&iacute;!' : evalText.innerHTML=this.comment; }
	this.appendChild(evalText);
        }
   targetEl.over = function (i) {
        for ( var j=0; j<5; j++ ) {
	  if ( (j+1)<=i ) { targetEl.children[j].style.backgroundImage = 'url(/obalky_dir/rating_add_plus.gif)';}
	  else { targetEl.children[j].style.backgroundImage = 'url(/obalky_dir/rating_add_minus.gif)';}
	  }
        }
   targetEl.set = function (i) { 
        var newRating = (i*2).toString(); //api prijima hodnoty 1-10
        var sendRating=new XMLHttpRequest();
        sendRating.url= '/obalky/'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now();
//        sendRating.url= '/cgi-bin/uncgi/redir.cgi?redd=' + encodeURI('http://'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now());
	sendRating.open("POST", sendRating.url, true);
	sendRating.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	sendRating.setRequestHeader("Content-length", (newRating.length+13) );
	sendRating.setRequestHeader("Connection", "close");
	sendRating.timeout=15*1000;
//	sendRating.ontimeout = function() { targetEl.children[5].innerHTML='Chyba při čtení odpovědi. Prosíme, zkuste přidat hodnocení později.'; }
	sendRating.ontimeout = function() { console.error('Chyba pri cteni odpovedi - timeout(15 sekund). Prosime, zkuste pridat hodnoceni pozdeji.'); }
	sendRating.send('rating_value='+newRating);
	sendRating.onreadystatechange=function () {
	   if (sendRating.readyState==4 && sendRating.status==200 ) {
	     if (sendRating.responseText.trim()=='ok') {
		console.log('Hodnoceni (review) uspesne poslano na obalkyknih.cz');
		}
	     else { 
//		targetEl.comment='Omlouváme se za chybu při přidávání hodnocení. Prosíme, zkuste to později. ';
//		console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendRating.url+'): '+sendRating.responseText);
		console.log('Hodnoceni (review) poslano na obalkyknih.cz, ale server nevratil potvrzeni ("ok").');
		}
	     }
	   else if (sendRating.readyState==4 && sendRating.status>=400 ) {
//		targetEl.comment='Omlouváme se za chybu při přidávání hodnocení. Prosíme, zkuste to později. ';
		console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendRating.url+'), http code: '+sendRating.status);
		}
	   }
	targetEl.comment='D&ecaron;kujeme za Va&scaron;e hodnocen&iacute;! '; 
	rating100=Math.round(((rating100*ratingCount)+(i*20))/(ratingCount+1));
	ratingCount++;
	ratingAvg5=Math.round(rating100/20);
	targetEl.over=function() {return false;}
	targetEl.set=function() { targetEl.comment='Tento dokument jste ji&zcaron; ohodnotili.'; }	
	targetEl.block=true;
	targetEl.show();
    }
obalkyKnih.showReviews = function(bookID, reviews) {
   var targetEl=document.querySelectorAll('#ob_reviews')[0] ;//tento html element <div id="ob_reviews"></div> umistete na stranku, kde maji byt zobrazeny komentare
   if ( targetEl==null ) {console.error('Element pro umisteni komentaru z obalkyknih.cz neexistuje!');return;}
   if ( typeof reviews == 'undefined') {  var reviews=new Object(); } //ver 1.1
   targetEl.show=function() {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i=0; i<(reviews.length); i++) {
	 if ( typeof reviews[i].html_text == 'string' ) { if (reviews[i].html_text.trim() != '') {
		reviews[i].library_name = reviews[i].library_name || '';
		var repeating=false; //vylouci se shodne komentare od teze knihovny - potencialni chyba
	        for (var j=0; j<i; j++) {
		   if ( reviews[i].html_text==reviews[j].html_text && ((reviews[i].sigla||'').trim()==(reviews[j].sigla||'').trim() || reviews[i].sigla=='' ) ) { repeating=true; break;}  }
		if (repeating) continue;
		var viewRev=document.createElement('div'); viewRev.className='userReviews';
		viewRev.innerHTML='<img src="/obalky_dir/comment.png" alt="">'+reviews[i].html_text.trim();
	        if ( typeof reviews[i].created!='undefined' && typeof reviews[i].library_name!='undefined' ) {
		   var datum=new Date(reviews[i].created);    
		   var dummy=document.createElement('div'); dummy.innerHTML=reviews[i].library_name;
		   viewRev.setAttribute('title2','Komentář přidán: '+datum.getDate()+'. '+(datum.getMonth()+1)+'. '+datum.getFullYear()+', čtenářem knihovny: '+dummy.innerHTML);}
		this.appendChild(viewRev);
		} }	 
	 }
	 this.style.display='';
	 var addRev=document.createElement('div'); 
	 addRev.style.display='none'; 
         addRev.ta=document.createElement('textarea'); addRev.ta.className="newReview"; 
	 addRev.ta.emptyValue='Zde p&rcaron;idejte sv&uring;j koment&aacute;&rcaron;...\nVa&scaron;e ohodnocen&iacute; bude sd&iacute;leno s &ccaron;ten&aacute;&rcaron;i ostatn&iacute;ch knihoven pomoc&iacute; slu&zcaron;by obalkyknih.cz.';
	 addRev.ta.value=addRev.ta.emptyValue;
	 addRev.ta.onclick=function() { addRev.ta.value=addRev.ta.value.replace(addRev.ta.emptyValue,''); }
	 addRev.appendChild(addRev.ta);
	 addRev.but=document.createElement('img'); addRev.but.src='/obalky_dir/f-add.gif'; addRev.but.setAttribute('alt','Přidat');
	 addRev.but.style.marginLeft='10em';
         addRev.but.onclick=function() { addRev.style.display='none'; 
					if ( addRev.ta.value!=addRev.ta.emptyValue && addRev.ta.value.trim()!='') targetEl.set(addRev.ta.value); else addRev.but.style.display='';}
	 addRev.butC=document.createElement('img'); addRev.butC.src='/obalky_dir/f-cancel.gif'; addRev.butC.setAttribute('alt','Zru&scaron;it');
	 addRev.butC.style.marginLeft='2em';
         addRev.butC.onclick=function() { addRev.style.display='none'; addRev.but0.style.display='';}
	 addRev.appendChild(addRev.butC);addRev.appendChild(addRev.but);
	 this.appendChild(addRev);
	 addRev.but0=document.createElement('img'); addRev.but0.src='/obalky_dir/f-add-review.gif'; addRev.but0.setAttribute('alt','P&rcaron;idat koment&aacute;&rcaron;'); addRev.but0.style.marginLeft='1em';
	 addRev.but0.onclick=function() {addRev.but0.style.display='none'; addRev.style.display='block'; };
	 this.appendChild(addRev.but0);
      }   
   targetEl.set=function(review) {
	review=String(review).replace(/<[^>]{2,10}>/g,'');
	if ( review.trim()=='' ) return;
        var sendAnniew=new XMLHttpRequest();
        sendAnniew.url= '/obalky/'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now();
        //sendAnniew.url= '/cgi-bin/uncgi/redir.cgi?redd=' + encodeURI('http://'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now());
        sendAnniew.open("POST", sendAnniew.url, true);
        sendAnniew.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        sendAnniew.setRequestHeader("Content-length", (review.length+12) );
        sendAnniew.setRequestHeader("Connection", "close");
        sendAnniew.timeout=15*1000;
        sendAnniew.ontimeout = function() { targetEl.showError('Chyba p&rcaron;i &ccaron;ten&iacute; odpov&ecaron;i. Pros&iacute;me, zkuste p&rcaron;idat hodnocen&iacute; pozd&ecaron;ji.');} 
        sendAnniew.send('review_text='+review);
        sendAnniew.onreadystatechange=function () {
           if (sendAnniew.readyState==4 && sendAnniew.status==200 ) {
             if (sendAnniew.responseText.trim()=='ok') {
		        var rl=reviews.length;
		        reviews[rl]= {};
		        reviews[rl].html_text=review;
		        reviews[rl].created=new Date();
		        reviews[rl].library_name='pr&aacute;v&ecaron; v&aacute;mi. D&ecaron;kujeme!';
		        targetEl.show();
		        }
	         else { targetEl.showError('Omlouv&aacute;me se za chybu p&rcaron;i p&rcaron;id&aacute;v&aacute;n&iacute; koment&aacute;&rcaron;e. Pros&iacute;me, zkuste to pozd&ecaron;ji.');
                console.error('Chyba pri pokusu o pridani noveho komentare ('+sendAnniew.url+'): '+sendAnniew.responseText); }
             }
	     else if (sendAnniew.readyState==4 && sendAnniew.status>=400 ) {
                targetEl.showError('Omlouv&aacute;me se za chybu p&rcaron;i p&rcaron;d&aacute;v&aacute;n&iacute; koment&aacute;&rcaron;e. Pros&iacute;me, zkuste to pozd&ecaron;ji. ');
                console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendAnniew.url+'), http code: '+sendAnniew.status);}
           targetEl.show(); //doplneno 20190412 Matyas Bajger
           }
	}
   targetEl.showError = function(text) {
	this.removeChild(this.children[this.children.length-1]); 
	var errorEl=document.createElement('span');
	var errorEl2=document.createTextNode(text);
	errorEl.appendChild(errorEl2); this.appendChild(errorEl);
      }
   targetEl.show();
   }
obalkyKnih.addOCRtoc = function(toc2send,partRoot) { //ver 1.1
	var sendTOC=new XMLHttpRequest();
	sendTOC.param=encodeURI('id='+sysno+'&toc='+toc2send+'&part_root='+partRoot+'&base='+obalkyKnih.base); 
	sendTOC.open("POST", '/cgi-bin/add_toc.cgi', true);
	sendTOC.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	sendTOC.setRequestHeader("Content-length", sendTOC.param.length );
	sendTOC.setRequestHeader("Connection", "close");
	sendTOC.send(sendTOC.param);
	}
//ver 1.3 funkce pro zobrazeni odkazu na digitalni objekty Kramerius, vc. DNNT
obalkyKnih.showDigObj = function(digObj) {
   	var targetEl=document.querySelectorAll('#ob_digobj')[0] ;//tento html element <div id="ob_digobj"></div> umistete na stranku, kde maji byt zobrazeny odkazy na digitalizovane verze
	if ( targetEl==null ) {console.error('Element pro umisteni odkazy na digitalizovane verze z obalkyknih.cz neexistuje!');return;}
	//nekolik parametru k zobrazeni:
        var showDNNT = true ; //true hodnota, pokud zobrazovat DNNT; 
        var homeSigla = '' ; //zpravidla domovska knihovna. Ukazuje se jako prvni a vzdy i v pripade autorizovaneho pristupu
        var showNonPublicSiglas = []; //pole obsahujici sigly, pro nez bude zobrazovan i autorizovany pristup
	var linkTextHome = 'Digitalizovan&aacute; verze v na&saron;&iacute; digit&aacute;ln&iacute; knihovn&ecaron;'; //text pro zobrazeni ve vlastni knihovne dle promenne homeSigla
        var linkTextPublic = 'Digitalizovan&aacute; verze' //text pro public verze v jinych knihovnach
        var linkTextNonPublic = 'Digitalizovan&aacute; verze - omezen&yacute p&rcaron;&iacutestup'; //text pro public verze v jinych knihovnach
        var linkTextDnnt = 'Digitalizovan&aacute; verze v knihovn&ecaron; D&ecaron;l nedostupn&yacutech na trhu'; //text pro public verze v jinych knihovnach
        targetEl.show = function (siglaw,publ,url,library,logo) { // zobrazi link na FT, ver1.3.2. add library name and logo
	    var poskytovatel='';
            //ver 1.3.2 library name
            if ( library!='') { poskytovatel = ' (poskytovatel: '+library+')'; }
	    if ( siglaw==homeSigla ) { var showText=linkTextHome; }
	    else if ( siglaw=='DNNT' ) { var showText=linkTextDnnt; }
	    else { var showText=linkTextPublic+poskytovatel; }
            //ver 1.3.2 library logo
            if ( logo!='' ) { showText = '<img src="'+logo+'" alt="" style="height: 2em; vertical-align:bottom; margin-right: 0.3em;">'+showText; } //comment this libe out to hide library logo
	    else { showText = '<img src="/exlibris/aleph/u23_1/alephe/www_f_cze/icon/f-tn-link.jpg" alt="" title="Digitalizovan&aacute; verze">'+showText; } 
            //ver 1.3.2 logit
            targetEl.innerHTML = targetEl.innerHTML + '<a href="'+url+'" target="_blank" onclick="logit(\''+url+'\');">'+showText+'</a><br><br>';// link a text
//koronavirus 20200122  - zpristupneni pro VS atd. do 30.6.2021 (odkomentuj v pripade potreby)
//            if ( url.indexOf('https://dnnt.mzk.cz/view/')>-1 ) {
//               targetEl.innerHTML = targetEl.innerHTML.replace(/<br><br>\s*$/,'<br><span style="font-family: Verdana; font-size: 80%;">Do 30. &ccaron;ervna 2021 je digit&aacute;ln&iacute; knihovna Moravsk&eacute; zemsk&eacute; knihovny zp&rcaron;&iacute;stupn&ecaron;na v pln&eacute;m rozsahu pro studenty V&Scaron; a v&ecaron;deck&eacute; pracovn&iacute;ky.<br>Ignoruje pros&iacute;m upozorn&ecaron;n&iacute;, &zcaron;e dokument nen&iacute; ve&rcaron;ejn&ecaron; p&rcaron;&iacute;stupn&yacute; a zvolte v horn&iacute;m menu vpravo "P&rcaron;ihl&aacute;sit". N&aacute;sledn&ecaron; zvolte tla&ccaron;&iacute;tko "P&rcaron;ihl&aacute;sit knihovn&iacute;m &uacute;&ccaron;tem/EduID" a p&rcaron;ihlaste se svou domovskou instituc&iacute;.</span><br><br');
//               }
//            else if ( url.indexOf('https://ndk.cz/view/')>-1 ) {
//               targetEl.innerHTML = targetEl.innerHTML.replace(/<br><br>\s*$/,'<br><span style="font-family: Verdana; font-size: 80%;">Do 30. &ccaron;ervna 2021 je N&aacute;rodn&iacute; digit&aacute;ln&iacute; knihovna zp&rcaron;&iacute;stupn&ecaron;na v pln&eacute;m rozsahu pro studenty V&Scaron; a v&ecaron;deck&eacute; pracovn&iacute;ky.<br>Ignoruje pros&iacute;m upozorn&ecaron;n&iacute;, &zcaron;e dokument nen&iacute; ve&rcaron;ejn&ecaron; p&rcaron;&iacute;stupn&yacute; a zvolte v horn&iacute;m menu vpravo "P&rcaron;ihl&aacute;sit". N&aacute;sledn&ecaron; zvolte tla&ccaron;&iacute;tko "P&rcaron;ihl&aacute;sit knihovn&iacute;m &uacute;&ccaron;tem/EduID" a p&rcaron;ihlaste se svou domovskou instituc&iacute;.</span><br><br');
//               }
//koronavirus end
            targetEl.style.display='';
	    }
	//homeSigla - domovska knihovna
	if ( homeSigla.trim() && typeof digObj[homeSigla] != 'undefined' ) {
            //ver 1.3.2 - library name and logo
	    targetEl.show(homeSigla, digObj[homeSigla].public, digObj[homeSigla].url, digObj[homeSigla].library, digObj[homeSigla].logo);  
	    }
	//ostatni Kramerie 
//RC20210817 - IE does not know '=> syntax' for forEach method
//      Object.keys(myDig).forEach(sigla => {
        Object.keys(digObj).forEach( function(sigla) {
	   //koronavirus 20200122 - zpristupneni pro VS atd. do 30.6.2021
	   //if ( ( sigla=='ABA001' || sigla=='BOA001' ) && !Boolean(digObj[sigla].public) ) {
           //   var uuid='';
           //   uuid=digObj[sigla].url.match(/uuid.*$/g);
           //   if ( uuid ) {
           //      if ( sigla=='ABA001' ) { var covidurl='https://ndk.cz/view/'+uuid[0]; }
           //      else { var covidurl='https://dnnt.mzk.cz/view/'+uuid[0]; }
           //      targetEl.show(sigla, true, covidurl, digObj[sigla].library, digObj[sigla].logo);
           //      }
           //   }
           //koronavirus end
	   
	   if ( ( sigla!='DNNT' && ( digObj[sigla].public || showNonPublicSiglas.includes(sigla) ) ) //not DNNT and ( public or not public set to be viewed)
               //RC20210831 - show links to DNNT for online available documents only, check new value of "dnnt_labels"
               //                  dnnt_labels possibla values: dnnto (online available), dnntt (on terminal in library only), covid (not in use)
               || (showDNNT && sigla=='DNNT' && (digObj[sigla].dnnt_labels || []).includes('dnnto') )  //DNNT - online documents only
               // || (showDNNT && sigla=='DNNT')  DNNT
               ) {
                //ver 1.3.2 - library name and logo
	        targetEl.show(sigla, digObj[sigla].public, digObj[sigla].url, digObj[sigla].library, digObj[sigla].logo);  
	        }	    
	    });
        
        
	}

//ver 1.3.2 logit (logging links)
function logit(x) {
  var y= new XMLHttpRequest();
  y.open('GET', '/cgi-bin/log_link.cgi?link='+encodeURI(x) );
  y.send();
  }
