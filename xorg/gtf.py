import sys
def gtf(h, v, f):
    CELL=8; MIN_PORCH=1; V_SYNC=3; HSP=8.0; MIN_VSBP=550.0
    C_P=30.0; M_P=300.0
    hp=round(h/CELL)*CELL; vl=v
    hpe=((1.0/f)-MIN_VSBP/1e6)/(vl+MIN_PORCH)*1e6
    vsbp=round(MIN_VSBP/hpe)
    tvl=vl+vsbp+MIN_PORCH
    vfe=1.0/hpe/tvl*1e6
    hper=hpe/(f/vfe)
    duty=C_P-(M_P*hper/1000.0)
    hb=round(hp*duty/(100.0-duty)/(2*CELL))*(2*CELL)
    tp=hp+hb
    pclk=tp/hper
    hs=round(HSP/100.0*tp/CELL)*CELL
    hfp=hb/2-hs
    if hfp<8:  # GTF на 30 Гц для узких режимов даёт отрицательный front porch: зажимаем до 8
        hbp=hb/2; hfp=8; tp=int(hp+hfp+hs+hbp); pclk=tp/hper
    return f'Modeline "{h}x{v}_{f:.2f}" {pclk:.2f} {hp} {int(hp+hfp)} {int(hp+hfp+hs)} {tp} {vl} {vl+1} {vl+1+V_SYNC} {tvl} -HSync +Vsync'
for a in sys.argv[1:]:
    w,hgt=a.split('x'); print(gtf(int(w),int(hgt),30.0))
