#!/bin/sh
ps aux |grep -v grep|grep node
sudo kill $(ps aux |grep -v grep|grep node|awk -F' ' '{print $2}')
nohup sudo env "PATH=$PATH" node server.js &
ps aux |grep -v grep|grep node
