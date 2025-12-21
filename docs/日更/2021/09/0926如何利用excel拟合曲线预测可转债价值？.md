各位同学大家好！上次我写了一篇[干货教程：如何预测新上市转债的价格？](https://mp.weixin.qq.com/s/ReUV6wIeXeposaOjdcfM1Q)

文中提到利用excel拟合曲线插值预测转债价格的方法，点赞过30了，看来感兴趣的朋友不少，今天给大家详细地写一下教程。

## 一、准备工具

1、Microsoft Excel

2、可转债数据：转股价值和转债价格

## 二、操作方法

1、从集思录或者宁稳网获取数据，长按鼠标左键从上到下选中所有可转债数据，然后复制

![宁稳数据](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/%E5%AE%81%E7%A8%B3%E6%95%B0%E6%8D%AE.png)

2、新建并打开一个excel表格，将刚才复制的数据粘贴进去

![粘贴数据](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.28.06.png)

3、删除多余的数据，只留下转股价值和转债价格，并将两列数据位置调换

剪切转股价值列：

![剪切转股价值](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.08.36.png)

选中转债价格列，在其前面插入剪切的单元格：

![插入](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.08.55.png)

4、选中数据，然后在“插入”中选择“X Y散点图”中的第一个“散点图”

![选择散点图](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.10.00.png)

5、在出现的图表中选择其中一点，右击并选择添加趋势线

![添加趋势线](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.31.36.png)

6、在出现的的“设置趋势线格式”界面中，选择趋势线选项“多项式”，勾选“显示公式”和“显示R平方值”选项，然后我们就得到了趋势线及方程

![生成方程](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.12.56.png)

7、根据生成的方程，我们就可以代入转股价值进行计算了。

## 三、高阶玩法

我之前说了：「这个方法的缺点就是每天都要复制可转债的转股价值和价格，生成一次公式再计算。我这么懒，肯定不能这么干，所以计划用python生成代码每天自动跑。」

下面就是我用python生成的代码，也分享给大家：

```python
import matplotlib.pyplot as plt
import numpy as np

# 转股价值
x = [1, 2, 3, 4, 5, 6, 7, 8]
# 转债价格
y = [1, 4, 9, 13, 30, 25, 49, 70]
# np.polyfit()可以对一组数据进行多项式拟合，3个参数表示用2次多项式拟合x，y数组
a = np.polyfit(x, y, 2)
# np.poly1d()生成多项式对象
b = np.poly1d(a)
print(b)
# 生成多项式对象之后，即可获取x在这个多项式处的值
c = b(x)
print(c)
# 输入转股价值即可生成拟合价格
d = b(99.8)
print(d)
# 对原始数据画散点图
plt.scatter(x, y, marker='o', label='original datas')
# 对拟合之后的数据，也就是x，c数组画图
plt.plot(x, c, ls='-', c='red', label='fitting with second-degree polynomial')
# 在图上标明一个图例，用于说明每条曲线的文字显示
plt.legend()
# 生成图表
plt.show()
```

执行代码，即可生成拟合价格：

![](https://zsyoung.oss-cn-hangzhou.aliyuncs.com/img/img/iShot2021-09-25%2014.23.09.png)

全文完。

如果大家觉得有所收获，麻烦点赞在看转发一键三连，创作不易，感谢您的支持！

