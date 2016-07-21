#!/bin/sh
ps aux |grep -v grep|grep node
sudo kill $(ps aux |grep -v grep|grep node|awk -F' ' '{print $2}')
nohup sudo /home/pi/btsync/nodejs/node-v5.0.0-linux-armv6l/bin/node server.js &
ps aux |grep -v grep|grep node
