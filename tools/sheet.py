import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f) for f in fs]
w,h=ims[0].size
cols=2; rows=(len(ims)+1)//2
s=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims): s.paste(im,((i%cols)*w,(i//cols)*h))
s.save(out)
