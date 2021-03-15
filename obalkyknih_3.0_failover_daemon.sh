#!/bin/bash
#lze spustit s parametrtem 'kill' - ukonci daemona.
#NASTAVITELNE PARAMETRY
alephe_root='/exlibris/aleph/u23_1/alephe/'
frontend_urls='cache.obalkyknih.cz cache2.obalkyknih.cz' #dalsi mozna URL p5idat do promenne za mezeru
check_frequency=60 #s jakou frekvenci se bude dostupnost serveru kontrolovat, v sekundach
URL_full_path_file="$alephe_root/www_f_cze/obalkyknih-url $alephe_root/www_f_eng/obalkyknih-url" #soubor s aktualni URL. Zde zajistuje ceskou verzi opacu. Pro dalsi pouzite jazyky lze pouzit Symlink na tento soubor z jejich www_f_{lng} adresare nebo do teto promenne pridat dalsi soubory oddelene mezerou
schwitch2first_after_hour=true #{true||false), volitelny parametr. Pokud je zaply, pak se po vice nez hodine necinnosti prvniho uvedeneho (prioritniho) frontendu prepne na tento prioritni frontend. Jinak (false) zustava i po hodine na poslednim zjistenem zivem frontendu.



#kill moznych jiz drive spustenych procesu tehoz daemona
for old_processes in $(ps -ef | grep $(basename ${0}) | grep -v 'grep ' | awk '{print $2}' | grep -v $$); do
   if [ $(ps -ef | awk '{print $2}' | grep $old_processes -c | bc) -ne 0 ]; then
      echo "`date`:: Killing the previous running of this daemon with PID $old_processes"
      kill $old_processes
   fi
done

#spusteno s parametrem kill - ukonci se beh daemona
echo $1
if [ "$1" == 'kill' ]; then
  echo "Zastavuji daemona."
  exit 0
fi


#pole pro skript a unix casy,kdy se URL ukazalo nedostupne. Nastaveni vychozich hodnot 
declare -a frontend_urls_array
declare -a dead_times	
for url in $frontend_urls; do 
   frontend_urls_array=(${frontend_urls_array[@]} "$url")
   dead_times=(${dead_times[@]} "0000000000")
done
frontend_urls_array_length=${#frontend_urls_array[@]}


#UVODNI NASTAVENI PRVNIHO URL a NASTAVENI SOUBORU S URL 
i=0
active_url=${frontend_urls_array[$i]}
echo "`date`:: START: $active_url"
for file_name in $URL_full_path_file; do
   echo "'$active_url'" >$file_name
done

#SAMOTNA KONTROLA
while true; do #nekonecny cyklus
   if [ "$schwitch2first_after_hour" = true -a $i -ne 0 -a `echo ${dead_times[0]} | bc` -lt `date '+%s' -d "1 hour ago" | bc` ]; then #volitelne prepinani na prvni prioritni frontend
      i=0
      active_url=${frontend_urls_array[$i]}
       for file_name in $URL_full_path_file; do
           echo "'$active_url'" >$file_name
       done
   fi
   check_response=`curl -s "http://$active_url/api/runtime/alive" --max-time 10` #ceka se max. 10 sekund na uplnou odpoved
   if [ "`echo "$check_response" | sed 's/ //g' | awk '{print toupper($0)}'`" == 'ALIVE' ]; then
      echo "`date`:: $active_url $check_response"
   else
      if [ "$active_url" != '' ]; then
         echo "`date`:: $active_url CHCIPNUL (`echo $check_response | sed 's/^$/no response/'`) - prepinam na jiny frontend"
      fi
      active_url=''
      dead_times[$i]=`date '+%s'`
      i=$(($i+1))
      if [ $i -eq $frontend_urls_array_length ]; then  #precislovani na konci pole
         i=0
      fi
      no_attemps=1
      while [ "$active_url" == '' ]; do  #cyklus hledajici aktivni frontend
         #nekontroluj chciple za posledni hodinu (pozadavek v dokumentaci)
         dt=$((`echo ${dead_times[$i]} | bc`))
         ha=$((`date '+%s' -d "1 hour ago" | bc`))
         if [[ $dt -lt $ha ]]; then 
            check_response=`curl -s "http://"${frontend_urls_array[$i]}"/api/runtime/alive" --max-time 10`
            echo "`date`:: kontrola "${frontend_urls_array[$i]}" - `echo $check_response | sed 's/^$/no response/'`"
            if [ "`echo "$check_response" | sed 's/ //g' | awk '{print toupper($0)}'`" == 'ALIVE' ]; then
               active_url=${frontend_urls_array[$i]}
               echo "`date`:: prepinam na url $active_url"
               for file_name in $URL_full_path_file; do
                  echo "'$active_url'" >$file_name
               done
               break
            else
               dead_times[$i]=`date '+%s'`
            fi
         else
            echo "`date`:: kontrola ${frontend_urls_array[$i]} preskocena (je min nez 1 hodinu po chcipnuti)"
w
         fi
         i=$(($i+1))
         if [ $i -eq $frontend_urls_array_length ]; then #precislovani po dosazeni konce pole s url
            i=0
         fi
         if [ $no_attemps -eq $frontend_urls_array_length  ]; then
            echo "`date`:: OOOPS! Zadny z definovanych frontendu nedava odpoved, ze je aktivni!"
            no_attemps=0
            sleep $check_frequency
         fi
         no_attemps=$(($no_attemps+1))
      done
   fi
   sleep $check_frequency
done
