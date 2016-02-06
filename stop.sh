#!/bin/sh
ps aux |grep -v grep|grep node
sudo kill $(ps aux |grep -v grep|grep node|awk -F' ' '{print $2}')
