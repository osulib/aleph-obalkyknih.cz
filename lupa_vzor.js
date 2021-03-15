//Vzorovy skript pro funkci ikonu lupy pro obsah
//Predpoklada, ze
//1. <table> se zobrazenim zaznamu ma atribut id="fullview"
//2. pole TOC se pomoci edit_doc_999.cze zobrazuje s navestim "Obsah"
//
//Patri do full-tail (resp. direct-tail, myshelf-full-tail opac www sablony



var fulltds=(document.getElementById('fullview') || document.createElement('table')).getElementsByTagName('td');
for ( var i=0; i<fulltds.length; i++) {
    if ( (i%2==0) && ((fulltds[i].textContent.match( new RegExp('^\\s*Obsah\\s*'+String.fromCharCode(36)) ) || '').length!=0) ) { //najde sloupec s obsahem
      if (  (fulltds[i+1] || document.createElement('span')).innerHTML.indexOf('id="normalb"') ==-1 ) { //takto aleph znaci tucne nalezene retezce, pak se nezmensi
         fulltds[i].innerHTML = fulltds[i].innerHTML+'<img src="&icon_path/lupa.gif" id="lupa" alt="Zvìtši" style="cursor: poiner;" onclick="zvetsiObsah(this)">'; //prida ikonu lupy
         fulltds[i+1].style.fontSize='60%'; //zmensi pismo textu obsahu          
         }
      } 
   }
function zvetsiObsah(x) {
     x.style.display='none';
     x.parentElement.nextSibling.style.fontSize='100%'; //zvetsi se pismo
}    
