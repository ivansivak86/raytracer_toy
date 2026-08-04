object Form3: TForm3
  Left = 195
  Top = 116
  Width = 1064
  Height = 493
  Caption = 'Form3'
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  Position = poScreenCenter
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object Img: TImage
    Left = 528
    Top = 8
    Width = 512
    Height = 384
  end
  object Label1: TLabel
    Left = 8
    Top = 432
    Width = 6
    Height = 13
    Caption = '0'
  end
  object Scn: TGLSceneViewer
    Left = 8
    Top = 8
    Width = 512
    Height = 384
    Camera = GLCamera1
    Buffer.BackgroundColor = clBlack
    OnMouseDown = ScnMouseDown
    OnMouseMove = ScnMouseMove
  end
  object Button1: TButton
    Left = 400
    Top = 424
    Width = 121
    Height = 25
    Caption = 'Render'
    TabOrder = 1
    OnClick = Button1Click
  end
  object ProgressBar1: TProgressBar
    Left = 8
    Top = 400
    Width = 513
    Height = 16
    TabOrder = 2
  end
  object GLScene1: TGLScene
    Left = 480
    Top = 88
    object GLDummyCube1: TGLDummyCube
      Visible = False
      Hint = 'camera1'
      CubeSize = 0.200000002980232200
      EdgeColor.Color = {0000000000000000000000000000803F}
    end
    object GLPlane1: TGLPlane
      Direction.Coordinates = {000000000000803F25D97C3200000000}
      PitchAngle = 90.000000000000000000
      Position.Coordinates = {B66796BD000000004182E2BD0000803F}
      Up.Coordinates = {0000000025D97C32000080BF00000000}
      Height = 40.000000000000000000
      Width = 40.000000000000000000
      NoZWrite = False
    end
    object cube83: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {5C20F1BFBADB7C3F2A8CEDBD0000803F}
      CubeSize = {0AD7A33C000000400000A040}
    end
    object Obj84: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {4E7A0D40E0DB7C3F78B928BE0000803F}
      CubeSize = {0AD7A33C000000400000A040}
    end
    object Obj85: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {F5B91A3EE0DB7C3F2EFF27C00000803F}
      CubeSize = {33338340000000400AD7A33C}
    end
    object Obj86: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Direction.Coordinates = {000000000000803F2EBD3BB300000000}
      PitchAngle = 90.000000000000000000
      Position.Coordinates = {8E0670BDCA6C10BD02B7EEBD0000803F}
      Up.Coordinates = {000000002EBD3BB3000080BF00000000}
      CubeSize = {33338340000000400AD7A33C}
    end
    object cylinder87: TGLCylinder
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {F0A2AFBC52491D392619F9BE0000803F}
      BottomRadius = 0.100000001490116100
      Height = 0.800000011920928900
      TopRadius = 0.100000001490116100
    end
    object Obj88: TGLCylinder
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {65FC7BBC9626253AEA95023F0000803F}
      BottomRadius = 0.100000001490116100
      Height = 0.800000011920928900
      TopRadius = 0.100000001490116100
    end
    object torus89: TGLTorus
      Material.LibMaterialName = 'LibMaterial'
      Direction.Coordinates = {000000000000803F25D97C3200000000}
      PitchAngle = 90.000000000000000000
      Position.Coordinates = {B29DEF3DBD18CA3DAF08FE3C0000803F}
      Up.Coordinates = {0000000025D97C32000080BF00000000}
      MajorRadius = 1.000000000000000000
      MinorRadius = 0.100000001490116100
      Rings = 40
      Sides = 16
    end
    object sphere91: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {D342D03E95EB4B3EFA61E4BE0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj92: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {1EDC9DBCCC99193F45BBFABE0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object cube94: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {3277A9BF000000009222323F0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj95: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {527E96BFB2254D3E721646BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj96: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {C0FCB2BFEBF98036FB4FBEBD0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj97: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {4DD658BF1B264D3E9D4BB9BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj98: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {F697B1BFF4254D3E0DC3DFBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj99: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {8CD651BEEE254D3E3F8CDCBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj100: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {2C2BFD3EEE254D3EA2D1BDBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj101: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {5709923F32264D3E2462F6BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj102: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {17829C3FEE254D3E53CB96BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj103: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {F697ADBF923F003F6F9EBA3E0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj104: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {D95FB6BFB43F003FB9C772BE0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj105: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {384A86BFDBA7333FD977F1BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj106: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {287EACBFDBA7333FE92B60BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj107: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {9A77CCBEE1A7333F4B93EEBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj108: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {3A585F3FDBA7333FE275CDBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj109: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {A66178BC9A99193F1040023F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj110: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {8A16B93EB08E4B3E677E353D0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj111: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {8D973E3F66EB4B3EC93CF2BD0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj112: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {18B22A3F9EEA4B3E67EDB63E0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj113: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {D9C0B43E4EEC4B3EB493233F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj114: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {58FF673CDE2C4C3E6C04823E0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj115: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {406A0BBF5F984C3EE44EA93D0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj116: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {9FC8133C958F4B3E001D26BE0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj117: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {1895C4BE0C8F4B3E6C21A8BE0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj118: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {BDE3B4BE07714C3E2E39EE3E0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj119: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {8880CFBFC91F803F0A2E063F0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj120: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {EBFFBCBFC91F803FC30DF8BC0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj121: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {1AFAC7BF63B9993F85424CBF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj122: TGLCube
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Position.Coordinates = {204648BF63B9993FF628F8BF0000803F}
      CubeSize = {0000003F0000003F0000003F}
    end
    object Obj123: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {B30CB1BEE17F4B3E807DAC3F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj124: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {DA1B64BF97EB4B3EB797A43F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj125: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {3962553F280F4B3E0CEAA33F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj126: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {6132953E3A804B3E971CB33F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj127: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {D49AA23F4B0F4B3E5C77733F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj128: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {213CC23F280F4B3E42B2083F0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj129: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {2D09B03F5A684A3ED49AC6BE0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object Obj130: TGLSphere
      Material.FrontProperties.Diffuse.Color = {8180003F8180003F8180003F0000803F}
      Material.FrontProperties.Shininess = 50
      Material.FrontProperties.Specular.Color = {0000803F0000803F0000803F0000803F}
      Position.Coordinates = {67DAD13FBE644A3EE4B4443C0000803F}
      Radius = 0.200000002980232200
      Slices = 32
      Stacks = 24
    end
    object GLLightSource1: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {0000E04000005842000004420000803F}
      LightStyle = lsOmni
      Specular.Color = {0000803F0000803F0000803F0000803F}
      SpotCutOff = 180.000000000000000000
    end
    object GLCamera1: TGLCamera
      DepthOfView = 250.000000000000000000
      FocalLength = 50.000000000000000000
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000C03F0000C03F0000C03F0000803F}
    end
  end
end
