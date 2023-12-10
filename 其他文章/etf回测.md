均以收盘价进行回测，	

data['return'] = data['price1'].pct_change().shift(-1)

1、不加货基，包含相关性择时，如果相关性大于0.85就空仓：

![image-20230601091617971](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601091617971.png)

![image-20230601091644842](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601091644842.png)

2、不加货基，不做择时

![image-20230601091834063](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601091834063.png)

![image-20230601091853076](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601091853076.png)

3、添加货基，不做择时

![image-20230601092404263](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601092404263.png)

![image-20230601092417149](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/image-20230601092417149.png)