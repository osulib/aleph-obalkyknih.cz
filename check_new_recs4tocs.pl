#!/exlibris/aleph/a22_1/product/bin/perl
# dohleda zaznamy zmenene v posledni dobe - pocet dnu zpet lze zadat jako parametr pri spusteni. Bez parametru vychozi je 7 dnu. K zaznamum dohledava OCR obsah v obalkyknih.cz
#version 1.3.5 https://github.com/osulib/aleph-obalkyknih.cz/issues/5 (cache.obalkyknih.cz reqiuires https)
use strict;
use warnings;
use utf8;
binmode(STDOUT, ":utf8");
binmode(STDIN, ":utf8");
use LWP;
use utf8;
use XML::Simple;
use CGI;
use POSIX qw/strftime/;
use Data::Dumper;
use DBI;
$ENV{NLS_LANG} = 'AMERICAN_AMERICA.AL32UTF8';
local $/=undef;

my $sid = 'dbi:Oracle:host=localhost;sid=aleph22';
my $bibBase = 'xxx01';
my $obDomainFile='/exlibris/aleph/u22_1/alephe/www_f_cze/obalkyknih-url';
my $dir4TOCs='/exlibris/aleph/u22_1/alephe/sctatch';
my $daysBack=7;




my $dnes = strftime "%Y%m%d", localtime;
#read actual obalkyknih.cz domain
open DOMFILE, "<", $obDomainFile or die "Error - cannot open file with obalkyknih domain: $obDomainFile -- $!";
my $obDomain = <DOMFILE>;
$obDomain =~ s/'//g; $obDomain =~ s/[\n\r]//g;
if ( $obDomain eq '' ) {die "Error reading domain from file $obDomainFile - no domain text found there.";}

sub sqlQuery {
   #run select sql given as argument to this sub. Select must return just 1 row. Returns and 1-dimensional array with results.
   my $query=shift;
   my $dbh = DBI->connect($sid, $bibBase, $bibBase) or die 'ERROR '.DBI->errstr.' when connecting to database';
   my $qrun = $dbh->prepare($query) or die 'ERROR '.DBI->errstr." when preparing sql: $query";
   $qrun->execute or die 'ERROR '.DBI->errstr.' '.$qrun->errstr." in execution of sql: $query";
   my @qAr; my @tmpAr; 
   $dbh->disconnect();
   @qAr;
   }

#1. find recently changed, the number of days can be set as a command line argument to the scirpt (>check_new_recs4tocs.perl 5). The default value is a week (7 days)
if ( defined($ARGV[0]) && $ARGV[0]=~/\d+/ ) { 
   $daysBack=$ARGV[0]; $daysBack =~ /\d+/;}
my $dateBack = strftime "%Y%m%d", localtime( time-($daysBack*24*60*60) );
#find recently changed records 


my @recentlyChanged = &sqlQuery("select Z13_REC_KEY from z13 where Z13_UPDATE_DATE>='$dateBack' minus select z00r_doc_number from z00r where z00r_field_code='TOC'");
if ( scalar(@recentlyChanged) == 0 ) {
   print "No records found changed in the last $daysBack days that have no TOC file. Bye.\n";
   exit 1; }
foreach (@recentlyChanged) {
   my $sysno=$_;
   #find book identificators
   print "processing sysno $sysno ... (seeking book indicators)\n";
   my @isbns; @isbns = &sqlQuery("select substr(regexp_substr(Z00R_TEXT,'\\\$\\\$a[^\$]*'),4) from z00r where z00r_doc_number='$sysno' and (z00r_field_code like '02%' or z00r_field_code like '902%')");
   my @cnbs; @cnbs = &sqlQuery("select substr(regexp_substr(Z00R_TEXT,'\\\$\\\$a[^\$]*'),4) from z00r where z00r_doc_number='$sysno' and z00r_field_code like '015%'");
   my @oclcs; @oclcs = &sqlQuery("select substr(regexp_substr(Z00R_TEXT,'\\\$\\\$a[^\$]*'),4) from z00r where z00r_doc_number='$sysno' and z00r_field_code like '035%'");
   if ( scalar(@isbns) + scalar(@cnbs) + scalar(@oclcs) == 0 ) {
      print "The record has no book indicators (ISxN,CNB,OCLCNo)\n";
      next; }
   #ask obalkyknih.cz
   #my $obURL="http://aleph.osu.cz/obalky/$obDomain/api/books?multi=[{";
   #my $obURL="http://$obDomain/api/books?multi=[{";
   #version 1.3.5
   my $obURL="https://$obDomain/api/books?multi=[{";
   $obURL =~ s/[\n\r]//g;   $obURL =~ s/[\r\n]//g; 
   if ( scalar(@isbns)!=0 && defined $isbns[0] ) { foreach (@isbns) { $obURL .= '%22isbn%22%3A%22'.$_.'%22%2C' ; } }
   if ( scalar(@cnbs)!=0 && defined $cnbs[0] ) { foreach (@cnbs) { $obURL .= '%22nbn%22%3A%22'.$_.'%22%2C' ; } }
   if ( scalar(@oclcs)!=0 && defined $oclcs[0] ) { foreach (@oclcs) { $obURL .= '%22oclc%22%3A%22'.$_.'%22%2C' ; } }
   $obURL =~ s/%2C$//; 
   $obURL .= '}]';
   print "asking API @ $obURL\n";
   my $obRequest = LWP::UserAgent->new;
   my $obRequestGet = $obRequest->get( $obURL );
   unless ( $obRequestGet->is_success ) { print "ERROR - no response from obalkyknih : ".$obRequestGet->status_line."\n"; }
   else {
      #my $objson=$obRequestGet->content; -toto nefungovalo radne pro utf
      my $objson=$obRequestGet->decoded_content();
      if(utf8::is_utf8($objson)) { 
         utf8::decode($objson);}
      if ( $objson =~ '"toc_full_text"' ) {
         #pridani identifikace souborneho zaznamu
	 my $partRoot='';
	 if  ( $objson =~ '"part_root"\s*:\s*"*1' ) { $partRoot='ROOT'; }
         #
         $objson =~ s/\\"/1u2v3o4z5o6v7k8y/g;
         $objson =~ s/^.*"\s*toc_full_text\s*"\s*:\s*"([^"]*)".*$/$1/;
         $objson =~ s/1u2v3o4z5o6v7k8y/"/g;
         $objson =~ s/\\n/ \/\/ /g;
         $objson =~ s/\\r//g;
         $objson =~ s/\\t/   /g;
         $objson =~ s/\\s//g;
         my $filename="$dir4TOCs/TOC$sysno$partRoot.$dnes";
         print "Adding toc for sysno $sysno - file $filename\n";
         open TOCFILE, '>:encoding(UTF-8)', $filename;
         print TOCFILE $objson;
         close TOCFILE;
         }
      else { print "Book metada has no OCR TOC (toc_full_text)\n"; }
      }
   sleep 1;
   }
   
