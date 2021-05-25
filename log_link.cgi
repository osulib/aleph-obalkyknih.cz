#!/exlibris/aleph/a23_1/product/bin/perl
use warnings;
use strict;
use utf8;
binmode(STDOUT, ":utf8");
binmode(STDIN, ":utf8");
use URI::Escape;
use LWP;
use CGI;
use POSIX qw/strftime/;

#Loguje linky na externi sluzby a plne textz, ktere nejsou v evenetech Alephu. byly pridanz externi sluzbou, napr. z obalkzknih.cz (ver. 1.3.2)
#    Vola se DOM eventem asynchronne v samotnem linku an externi objekt.
#url parametr: link
#Matyas Bajger cca 2013
#RC1 - dlf api does not use //error node as xserver. In every response, there are //reply-code (000=ok, other=error)  and  //reply-text with text message
#      matyas bajger 20140901

#initial variables ee
my $logfile='/exlibris/aleph/a23_1/log/log_link_opac.log';



#get request with comment from opac
my $comm_in = CGI->new;
my $comm_out = CGI->new;
my $extLink = $comm_in->param('link') || '';
my $remote_host = $comm_in->remote_host();
my $remote_addr = $comm_in->remote_addr();
my $tajmstemp = strftime "%Y%m%d-%H:%M:%S", localtime;
open ( LOGFILE, ">>$logfile" );
print LOGFILE "$tajmstemp - $remote_addr ($remote_host) : $extLink\n";
close (LOGFILE);
print $comm_out->header(-type=>'text/plain', -charset=>'utf-8');
print "OK\n";

