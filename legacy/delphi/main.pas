unit main;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, GLObjects, GLScene, GLMisc, StdCtrls, ExtCtrls, GLWin32Viewer,GLTexture,
  VectorGeometry, Polynomials, GLCrossPlatform, GLShadowPlane, GLGeomObjects,
  GR32, GLVectorFileObjects, GLFile3DS, ComCtrls, GLTeapot, GLGraph, VectorTypes,
  GLPolyhedron, GR32_Resamplers;

  const TRACEDEPTH = 5;

  type
   PRGBTripleArray = ^TRGBTripleArray;
   TRGBTripleArray = array[0..32767] of TRGBTriple;

type
  TForm3 = class(TForm)
    Scn: TGLSceneViewer;
    GLScene1: TGLScene;
    Img: TImage;
    Button1: TButton;
    ProgressBar1: TProgressBar;
    GLDummyCube1: TGLDummyCube;
    GLCamera1: TGLCamera;
    GLLightSource1: TGLLightSource;
    GLPlane1: TGLPlane;
    cube83: TGLCube;
    Obj84: TGLCube;
    Obj85: TGLCube;
    Obj86: TGLCube;
    cylinder87: TGLCylinder;
    Obj88: TGLCylinder;
    torus89: TGLTorus;
    sphere91: TGLSphere;
    Obj92: TGLSphere;
    cube94: TGLCube;
    Obj95: TGLCube;
    Obj96: TGLCube;
    Obj97: TGLCube;
    Obj98: TGLCube;
    Obj99: TGLCube;
    Obj100: TGLCube;
    Obj101: TGLCube;
    Obj102: TGLCube;
    Obj103: TGLCube;
    Obj104: TGLCube;
    Obj105: TGLCube;
    Obj106: TGLCube;
    Obj107: TGLCube;
    Obj108: TGLCube;
    Obj109: TGLSphere;
    Obj110: TGLSphere;
    Obj111: TGLSphere;
    Obj112: TGLSphere;
    Obj113: TGLSphere;
    Obj114: TGLSphere;
    Obj115: TGLSphere;
    Obj116: TGLSphere;
    Obj117: TGLSphere;
    Obj118: TGLSphere;
    Obj119: TGLCube;
    Obj120: TGLCube;
    Obj121: TGLCube;
    Obj122: TGLCube;
    Obj123: TGLSphere;
    Obj124: TGLSphere;
    Obj125: TGLSphere;
    Obj126: TGLSphere;
    Obj127: TGLSphere;
    Obj128: TGLSphere;
    Obj129: TGLSphere;
    Obj130: TGLSphere;
    Label1: TLabel;
    procedure FormCreate(Sender: TObject);
    procedure ScnMouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure ScnMouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Button1Click(Sender: TObject);
  private
  public
    RenderOutput: TBitmap32;
    mdx, mdy : Integer;

    RenderResX, RenderResY: Integer;
    LightObj: TGLLightSource;
    procedure precalculateColors;
    Procedure DoRender;
    { o is the ray origin; v is the normalized ray direction. }
    Function RayTrace(o,v, xlight: TVector;x,y: integer;aDepth: Integer; var aC: TVector): TGLBaseSceneObject;

  end;

var
  Form3: TForm3;

implementation

{$R *.dfm}

Procedure TForm3.DoRender;
var
   o, v, vLight, light, iPoint, iNormal, vs : TVector;
   up, right, dir : TVector;
   x, y, dx, dy, tx, ty : Integer;
   f,f2: Single;
   iObj, prim, lastprim : TGLBaseSceneObject;
   aac: TVector;
   XB: TBitmap32;
   bSRX, bSRY: Integer;
begin
   bSRX := Scn.Width;
   bSRY := Scn.Height;
   Scn.Width := RenderResX * 2;
   Scn.Height := RenderResY * 2;
   Scn.Visible := false;

   { Allocate the final display bitmap at the requested output dimensions. }
   XB := TBitmap32.Create;
   XB.Width := Img.Width;    // Match the requested output width.
   XB.Height := Img.Height;  // Match the requested output height.
   XB.DrawMode := dmBlend;

   RenderOutput := TBitmap32.Create;
   RenderOutput.DrawMode := dmBlend;
   RenderOutput.Width := Scn.Width;
   RenderOutput.Height := Scn.Height;

   Screen.Cursor:=crHourGlass;
   { Initialize the camera and light vectors. }
   MakePoint (o,   GLCamera1.AbsolutePosition);
   MakeVector(dir, VectorNormalize( VectorSubtract(GLDummyCube1.Position.AsVector,GLCamera1.Position.AsVector)));
   MakeVector(up,  GLCamera1.AbsoluteUp);
   MakePoint(light, GLLightSource1.AbsolutePosition);
   lastprim := NIL;

   right:=VectorCrossProduct(dir, up);
   f  := 1/((Scn.Width+Scn.Height)/3);
   f2 := 1/((Scn.Width+Scn.Height)/3);
   dx:=(Scn.Width div 2);
   dy:=(Scn.Height div 2);
   RenderOutput.Clear(clWhite);

   ProgressBar1.Max := (Scn.Width*Scn.Height)-2;
   ProgressBar1.Position := 0;
   { Trace one primary ray for every supersampled pixel. }
   for y:=0 to Scn.Height-1 do begin
      for x:=0 to Scn.Width-1 do begin
         v:=VectorCombine3(dir, right, up, 1, (x-dx)*f, (dy-y)*f2);
         NormalizeVector(v);

         MakeVector(aac, 0, 0, 0);
         prim := RayTrace(o, v, light, x, y, 1, aac);

      end;
   end;

   Img.Picture.Bitmap.Canvas.FillRect(Img.ClientRect);

   StretchTransfer(XB,XB.BoundsRect,XB.BoundsRect,RenderOutput,RenderOutput.BoundsRect,
                   TLinearResampler.Create(XB),dmBlend);
   XB.Changed;

   Img.Picture.Bitmap.Assign(XB);
   
   Screen.Cursor:=crDefault;

   RenderOutput.Free;
   XB.Free;
   ProgressBar1.Position := 0;

   Scn.Width := bSRX;
   Scn.Height := bSRY;
   Scn.Visible:= True;
end;

procedure TForm3.Button1Click(Sender: TObject);
Var T: Int64;
begin
  T := GetTickCount;
  DoRender;
  Label1.Caption := IntToStr((GetTickCount - T) div 1000)+' seconds';
end;

function TForm3.RayTrace(o, v, xlight: TVector;x,y: integer;aDepth: Integer;var aC: TVector): TGLBaseSceneObject;
var
   vLight, iPoint, iNormal, lColor, fColor, L, v2,R, R2, v3, light: TVector;
   d, refr, rindex, n, cosI, cosT2 : Single;
   iObj, sObj : TGLBaseSceneObject;
   Stin, tdist, sdot, spec: Single;
   I, J: Integer;
   a_aC, T, absorbance, transparency, v4: TVector;
begin
     iObj:=GLScene1.RayCastIntersect(o, v, @iPoint, @iNormal);

     if Assigned(iObj) then begin
      if iObj.Visible then begin
        with (iObj as TGLCustomSceneObject).Material.FrontProperties do begin
          For J := 0 to GLScene1.Objects.Count-1 do begin
           if GLScene1.Objects[J] is TGLLightSource then begin
            LightObj := TGLLightSource(GLScene1.Objects[J]);
            MakePoint(light, LightObj.AbsolutePosition);

            lColor := LightObj.Diffuse.Color;
            vLight:=VectorSubtract(light, iPoint);
            NormalizeVector(vLight);
            NormalizeVector(iNormal);
            d:=VectorDotProduct(iNormal, vLight);
            if d<0 then d:=0;

               { Determine whether the light is occluded from the hit point. }
               Stin := 1.0;
               L := VectorSubtract(light, iPoint);
               tdist := VectorLength(L);
               L[0] := L[0] * (1/tdist);L[1] := L[1] * (1/tdist);
               L[2] := L[2] * (1/tdist);L[3] := 0;
               v2[0] := L[0] * 0.0001;v2[1] := L[1] * 0.0001;
               v2[2] := L[2] * 0.0001;v2[3] := 0;

               sObj := GLScene1.RayCastIntersect(VectorAdd(iPoint, v2), L);
               if assigned(sObj) then Stin := 0.3 else Stin := 1.0; // Preserve the original shadow intensity rule.


              if Stin > 0.3 then begin
              { Add the diffuse contribution, including the light color. }
               fColor[0] := (aC[0]+(Diffuse.Red*d * lcolor[0]) * Stin);
               fColor[1] := (aC[1]+(Diffuse.Green*d * lcolor[1]) * Stin);
               fColor[2] := (aC[2]+(Diffuse.Blue*d * lcolor[2]) * Stin);
               aC:= fColor;

               { Add the white specular highlight. }
               R[0] := vLight[0] - 2 * d * iNormal[0];
               R[1] := vLight[1] - 2 * d * iNormal[1];
               R[2] := vLight[2] - 2 * d * iNormal[2];
               sdot := VectorDotProduct(V, R);
               if sdot > 0 then begin
                spec := Power(sdot, 30) *  1 * Stin;  // The scalar value represents a white specular color.
                aC[0] := aC[0]+ spec * 1; // Specular color is supplied by the light rather than the material.
                aC[1] := aC[1]+ spec * 1;
                aC[2] := aC[2]+ spec * 1;
               end;
              end;

         end;end; // End of the light traversal.
               
               { Recursively trace mirror reflections for non-cube objects. }
               if not (iObj is TGLCube) then begin
                 R2[0] := V[0] - 2 * VectorDotProduct(V, iNormal) * iNormal[0];
                 R2[1] := V[1] - 2 * VectorDotProduct(V, iNormal) * iNormal[1];
                 R2[2] := V[2] - 2 * VectorDotProduct(V, iNormal) * iNormal[2];
                 v3[0] := R2[0] * 0.0001;
                 v3[1] := R2[1] * 0.0001;
                 v3[2] := R2[2] * 0.0001;
                 if aDepth < TRACEDEPTH then begin
                    a_aC := aC;
                    MakeVector(aC, 0, 0, 0);
                    RayTrace(VectorAdd(iPoint,v3), R2, light, x, y, aDepth+1, aC);
                                    // Tint the reflected contribution with the material diffuse color.
                    aC[0] := a_aC[0] + 0.95 * aC[0] * Diffuse.red ;
                    aC[1] := a_aC[1] + 0.95 * aC[1] * Diffuse.green ;
                    aC[2] := a_aC[2] + 0.95 * aC[2] * Diffuse.blue ;
                 end;
               end;

               { Experimental Snell-law refraction branch. }
               if iObj.Name = 'GLSphere50' then begin
                  refr := 0.8;
                  rindex := 1.3;
                  n := 1 / rindex;
                  cosI := -VectorDotProduct(iNormal, V);
                  cosT2 := 1.0 - n * n * (1.0 - cosI * cosI);
                  if cosT2 > 0 then begin
                     T[0] := (n * v[0]) + (n * cosI - sqrt(cosT2)) * iNormal[0];
                     T[1] := (n * v[1]) + (n * cosI - sqrt(cosT2)) * iNormal[1];
                     T[2] := (n * v[2]) + (n * cosI - sqrt(cosT2)) * iNormal[2];
                     T[0] := T[0] * 0.0001;
                     T[1] := T[1] * 0.0001;
                     T[2] := T[2] * 0.0001;
                     a_aC := aC;
                     MakeVector(aC, 0,0,0);
                     v4[0] := iPoint[0] + T[0];
                     v4[1] := iPoint[1] + T[1];
                     v4[2] := iPoint[2] + T[2];
                     RayTrace(v4,T,light,x,y,aDepth+1, aC);
                     absorbance[0] := Diffuse.Red * 0.15 * -d;
                     absorbance[1] := Diffuse.Green * 0.15 * -d;
                     absorbance[2] := Diffuse.Blue * 0.15 * -d;
                     transparency[0] := Exp(absorbance[0]);
                     transparency[1] := Exp(absorbance[1]);
                     transparency[2] := Exp(absorbance[2]);
                     aC[0] := a_aC[0] + aC[0] * transparency[0];
                     aC[1] := a_aC[1] + aC[1] * transparency[1];
                     aC[2] := a_aC[2] + aC[2] * transparency[2];
                  end;
               end;

            end;  // End material scope.
       end; // End visibility test.     
     end else aC:= ConvertWinColor(Scn.Buffer.BackgroundColor);

     if aC[0] > 1 then aC[0] := 1;
     if aC[1] > 1 then aC[1] := 1;
     if aC[2] > 1 then aC[2] := 1;


     I := x + y * Scn.Width;
     TColor32Entry(RenderOutput.Bits[I]).ARGB := Color32(ConvertColorVector(aC));
     TColor32Entry(RenderOutput.Bits[I]).A := 255;


     Result := iObj;
end;

procedure TForm3.ScnMouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
  mdx:=x; mdy:=y;
end;

procedure TForm3.ScnMouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
 var
	dx, dy : Integer;
	v : TVector;
begin
  dx:=mdx-x; dy:=mdy-y;
	mdx:=x; mdy:=y;
	if ssLeft in Shift then begin
      if ssalt in Shift then begin
		   GLCamera1.MoveAroundTarget(dy, dx);
      end;
		GLCamera1.TransformationChanged;
	end;
end;

procedure TForm3.FormCreate(Sender: TObject);
begin
  RenderResX := 512;
  RenderResY := 384;
  precalculateColors;
 { The original project also contained an optional .3DS model-loading experiment.
   It is represented by dedicated model presets in the modern port. }
end;

procedure TForm3.precalculateColors;
Var I: Integer;
begin
  For I := 0 to GLScene1.Objects.Count-1 do begin
     if (GLScene1.Objects[I] is TGLCube) or (GLScene1.Objects[I] is TGLSphere) or
        (GLScene1.Objects[I] is TGLTorus) or (GLScene1.Objects[I] is TGLCylinder) then begin
           TGLCustomSceneObject(GLScene1.Objects[I]).Material.FrontProperties.Diffuse.AsWinColor := RGB(50+Random(205),50+Random(205),50+Random(205));
        end;
  end;
end;

end.
